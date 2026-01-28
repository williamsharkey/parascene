import express from "express";
import { claudeGenerator } from "../services/claude-generator.js";
import { validateCode, smokeTest } from "../services/sandbox-runner.js";
import JSZip from "jszip";

// Cost constants
const GENERATION_COST = 20;
const REFINEMENT_COST = 10;

export default function createAiServersRoutes({ queries, storage }) {
  const router = express.Router();

  async function requireUser(req, res) {
    if (!req.auth?.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }

    const user = await queries.selectUserById.get(req.auth?.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return null;
    }

    return user;
  }

  async function requireProjectOwner(req, res, projectId) {
    const user = await requireUser(req, res);
    if (!user) return null;

    const project = await queries.selectAiServerProjectById.get(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return null;
    }

    if (project.user_id !== user.id && user.role !== 'admin') {
      res.status(403).json({ error: "Forbidden" });
      return null;
    }

    return { user, project };
  }

  async function checkCredits(userId, required) {
    const credits = await queries.selectUserCredits.get(userId);
    const balance = credits?.balance ?? 0;
    return balance >= required;
  }

  async function deductCredits(userId, amount) {
    await queries.updateUserCreditsBalance.run(userId, -amount);
  }

  // GET /api/ai-servers - List user's AI server projects
  router.get("/api/ai-servers", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;

    try {
      const projects = await queries.selectAiServerProjects.all(user.id);
      return res.json({ projects });
    } catch (error) {
      console.error("Error fetching AI server projects:", error);
      return res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // POST /api/ai-servers - Create new AI server project
  router.post("/api/ai-servers", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;

    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: "Name is required" });
    }

    try {
      const result = await queries.insertAiServerProject.run(
        user.id,
        name.trim(),
        description?.trim() || null
      );

      const project = await queries.selectAiServerProjectById.get(result.insertId);
      return res.status(201).json({ project });
    } catch (error) {
      console.error("Error creating AI server project:", error);
      return res.status(500).json({ error: "Failed to create project" });
    }
  });

  // GET /api/ai-servers/:id - Get project details
  router.get("/api/ai-servers/:id", async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    const result = await requireProjectOwner(req, res, projectId);
    if (!result) return;

    try {
      // Get versions count and latest version
      const versions = await queries.selectAiServerVersions.all(projectId);
      const liveVersion = result.project.live_version_id
        ? await queries.selectAiServerVersionById.get(result.project.live_version_id)
        : null;

      // Get royalty stats if deployed
      let royaltyStats = null;
      if (result.project.hosting_type === 'parasharkgod') {
        royaltyStats = await queries.selectAiServerRoyaltyStats.get(projectId);
      }

      return res.json({
        project: result.project,
        versionCount: versions.length,
        liveVersion,
        royaltyStats
      });
    } catch (error) {
      console.error("Error fetching AI server project:", error);
      return res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  // PUT /api/ai-servers/:id - Update project metadata
  router.put("/api/ai-servers/:id", async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    const result = await requireProjectOwner(req, res, projectId);
    if (!result) return;

    const { name, description, status, hosting_type } = req.body;
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: "Name must be a non-empty string" });
      }
      updates.name = name.trim();
    }
    if (description !== undefined) updates.description = description?.trim() || null;
    if (status !== undefined) {
      if (!['draft', 'ready', 'deployed'].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      updates.status = status;
    }
    if (hosting_type !== undefined) {
      if (hosting_type !== null && !['self', 'parasharkgod'].includes(hosting_type)) {
        return res.status(400).json({ error: "Invalid hosting type" });
      }
      updates.hosting_type = hosting_type;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No updates provided" });
    }

    try {
      await queries.updateAiServerProject.run(projectId, updates);
      const project = await queries.selectAiServerProjectById.get(projectId);
      return res.json({ project });
    } catch (error) {
      console.error("Error updating AI server project:", error);
      return res.status(500).json({ error: "Failed to update project" });
    }
  });

  // DELETE /api/ai-servers/:id - Delete project
  router.delete("/api/ai-servers/:id", async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    const result = await requireProjectOwner(req, res, projectId);
    if (!result) return;

    try {
      await queries.deleteAiServerProject.run(projectId);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting AI server project:", error);
      return res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // POST /api/ai-servers/:id/generate - Generate new version (20 credits)
  router.post("/api/ai-servers/:id/generate", async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    const result = await requireProjectOwner(req, res, projectId);
    if (!result) return;

    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Check credits before generation
    const hasCredits = await checkCredits(result.user.id, GENERATION_COST);
    if (!hasCredits) {
      return res.status(402).json({
        error: "Insufficient credits",
        required: GENERATION_COST
      });
    }

    try {
      // Generate server code using Claude
      const generated = await claudeGenerator.generateServer(prompt.trim());

      // Get next version number
      const nextVersion = await queries.getNextVersionNumber.get(projectId);

      // Create version record (pending status - not charged yet)
      const versionResult = await queries.insertAiServerVersion.run(
        projectId,
        nextVersion,
        prompt.trim(),
        null, // refinement_prompt
        generated.code,
        generated.config,
        GENERATION_COST,
        null // parent_version_id
      );

      const version = await queries.selectAiServerVersionById.get(versionResult.insertId);

      // Update project name/description if suggested
      if (generated.suggestedName || generated.suggestedDescription) {
        const updates = {};
        if (generated.suggestedName && !result.project.name) {
          updates.name = generated.suggestedName;
        }
        if (generated.suggestedDescription && !result.project.description) {
          updates.description = generated.suggestedDescription;
        }
        if (Object.keys(updates).length > 0) {
          await queries.updateAiServerProject.run(projectId, updates);
        }
      }

      return res.status(201).json({
        version,
        files: generated.files,
        suggestedName: generated.suggestedName,
        suggestedDescription: generated.suggestedDescription,
        cost: GENERATION_COST,
        note: "Credits will be deducted when you accept this version"
      });
    } catch (error) {
      console.error("Error generating AI server:", error);
      return res.status(500).json({ error: error.message || "Failed to generate server" });
    }
  });

  // POST /api/ai-servers/:id/refine - Refine existing version (10 credits)
  router.post("/api/ai-servers/:id/refine", async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    const result = await requireProjectOwner(req, res, projectId);
    if (!result) return;

    const { prompt, versionId } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({ error: "Refinement prompt is required" });
    }

    // Get the version to refine (either specified or latest)
    let parentVersion;
    if (versionId) {
      parentVersion = await queries.selectAiServerVersionById.get(versionId);
      if (!parentVersion || parentVersion.project_id !== projectId) {
        return res.status(404).json({ error: "Version not found" });
      }
    } else {
      parentVersion = await queries.selectLatestAiServerVersion.get(projectId);
      if (!parentVersion) {
        return res.status(400).json({ error: "No version to refine. Generate a version first." });
      }
    }

    // Check credits
    const hasCredits = await checkCredits(result.user.id, REFINEMENT_COST);
    if (!hasCredits) {
      return res.status(402).json({
        error: "Insufficient credits",
        required: REFINEMENT_COST
      });
    }

    try {
      // Refine using Claude
      const refined = await claudeGenerator.refineServer(
        parentVersion.generated_code,
        parentVersion.generated_config,
        prompt.trim()
      );

      // Get next version number
      const nextVersion = await queries.getNextVersionNumber.get(projectId);

      // Create new version
      const versionResult = await queries.insertAiServerVersion.run(
        projectId,
        nextVersion,
        parentVersion.user_prompt,
        prompt.trim(),
        refined.code,
        refined.config,
        REFINEMENT_COST,
        parentVersion.id
      );

      const version = await queries.selectAiServerVersionById.get(versionResult.insertId);

      return res.status(201).json({
        version,
        files: refined.files,
        changes: refined.changes,
        cost: REFINEMENT_COST,
        note: "Credits will be deducted when you accept this version"
      });
    } catch (error) {
      console.error("Error refining AI server:", error);
      return res.status(500).json({ error: error.message || "Failed to refine server" });
    }
  });

  // GET /api/ai-servers/:id/versions - List all versions
  router.get("/api/ai-servers/:id/versions", async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    const result = await requireProjectOwner(req, res, projectId);
    if (!result) return;

    try {
      const versions = await queries.selectAiServerVersions.all(projectId);
      return res.json({ versions });
    } catch (error) {
      console.error("Error fetching versions:", error);
      return res.status(500).json({ error: "Failed to fetch versions" });
    }
  });

  // POST /api/ai-servers/:id/versions/:vid/test - Run smoke test (free)
  router.post("/api/ai-servers/:id/versions/:vid/test", async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    const versionId = parseInt(req.params.vid, 10);
    if (isNaN(projectId) || isNaN(versionId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const result = await requireProjectOwner(req, res, projectId);
    if (!result) return;

    const version = await queries.selectAiServerVersionById.get(versionId);
    if (!version || version.project_id !== projectId) {
      return res.status(404).json({ error: "Version not found" });
    }

    try {
      // Run smoke tests
      const testResults = await smokeTest(version.generated_code, version.generated_config);

      // Update version with test results
      await queries.updateAiServerVersionStatus.run(versionId, 'testing', testResults);

      const allPassed = Object.values(testResults).every(t => t.passed);

      return res.json({
        success: allPassed,
        results: testResults
      });
    } catch (error) {
      console.error("Error running smoke test:", error);
      return res.status(500).json({ error: "Failed to run tests" });
    }
  });

  // POST /api/ai-servers/:id/versions/:vid/accept - Accept version and pay
  router.post("/api/ai-servers/:id/versions/:vid/accept", async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    const versionId = parseInt(req.params.vid, 10);
    if (isNaN(projectId) || isNaN(versionId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const result = await requireProjectOwner(req, res, projectId);
    if (!result) return;

    const version = await queries.selectAiServerVersionById.get(versionId);
    if (!version || version.project_id !== projectId) {
      return res.status(404).json({ error: "Version not found" });
    }

    if (version.status === 'accepted') {
      return res.status(400).json({ error: "Version already accepted" });
    }

    // Check credits
    const cost = version.generation_cost;
    const hasCredits = await checkCredits(result.user.id, cost);
    if (!hasCredits) {
      return res.status(402).json({
        error: "Insufficient credits",
        required: cost
      });
    }

    try {
      // Deduct credits
      await deductCredits(result.user.id, cost);

      // Update version status
      await queries.updateAiServerVersionStatus.run(versionId, 'accepted', version.test_result);

      // Update project status
      await queries.updateAiServerProject.run(projectId, {
        status: 'ready',
        live_version_id: versionId
      });

      const updatedVersion = await queries.selectAiServerVersionById.get(versionId);
      const updatedProject = await queries.selectAiServerProjectById.get(projectId);

      return res.json({
        version: updatedVersion,
        project: updatedProject,
        creditsDeducted: cost
      });
    } catch (error) {
      console.error("Error accepting version:", error);
      return res.status(500).json({ error: "Failed to accept version" });
    }
  });

  // POST /api/ai-servers/:id/versions/:vid/reject - Reject version (no charge)
  router.post("/api/ai-servers/:id/versions/:vid/reject", async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    const versionId = parseInt(req.params.vid, 10);
    if (isNaN(projectId) || isNaN(versionId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const result = await requireProjectOwner(req, res, projectId);
    if (!result) return;

    const version = await queries.selectAiServerVersionById.get(versionId);
    if (!version || version.project_id !== projectId) {
      return res.status(404).json({ error: "Version not found" });
    }

    if (version.status === 'accepted') {
      return res.status(400).json({ error: "Cannot reject an accepted version" });
    }

    try {
      await queries.updateAiServerVersionStatus.run(versionId, 'rejected', version.test_result);
      return res.json({ success: true });
    } catch (error) {
      console.error("Error rejecting version:", error);
      return res.status(500).json({ error: "Failed to reject version" });
    }
  });

  // PUT /api/ai-servers/:id/versions/:vid/set-live - Set version as live
  router.put("/api/ai-servers/:id/versions/:vid/set-live", async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    const versionId = parseInt(req.params.vid, 10);
    if (isNaN(projectId) || isNaN(versionId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const result = await requireProjectOwner(req, res, projectId);
    if (!result) return;

    const version = await queries.selectAiServerVersionById.get(versionId);
    if (!version || version.project_id !== projectId) {
      return res.status(404).json({ error: "Version not found" });
    }

    if (version.status !== 'accepted') {
      return res.status(400).json({ error: "Only accepted versions can be set as live" });
    }

    try {
      await queries.updateAiServerProject.run(projectId, { live_version_id: versionId });
      const updatedProject = await queries.selectAiServerProjectById.get(projectId);
      return res.json({ project: updatedProject });
    } catch (error) {
      console.error("Error setting live version:", error);
      return res.status(500).json({ error: "Failed to set live version" });
    }
  });

  // POST /api/ai-servers/:id/deploy - Deploy to parasharkgod
  router.post("/api/ai-servers/:id/deploy", async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    const result = await requireProjectOwner(req, res, projectId);
    if (!result) return;

    if (!result.project.live_version_id) {
      return res.status(400).json({ error: "No live version set. Accept a version first." });
    }

    try {
      // Get the live version
      const liveVersion = await queries.selectAiServerVersionById.get(result.project.live_version_id);
      if (!liveVersion) {
        return res.status(400).json({ error: "Live version not found" });
      }

      // Generate a unique server URL for this hosted server
      const serverUrl = `/api/hosted/${projectId}`;

      // Create or update the server in the servers table
      let serverId = result.project.deployed_server_id;
      if (serverId) {
        // Update existing server
        const existingServer = await queries.selectServerById.get(serverId);
        if (existingServer) {
          await queries.updateServer.run(serverId, {
            ...existingServer,
            name: result.project.name,
            description: result.project.description,
            status: 'active',
            server_config: liveVersion.generated_config
          });
        }
      } else {
        // Create new server
        const serverResult = await queries.insertServer.run(
          result.user.id,
          result.project.name,
          'active',
          serverUrl,
          liveVersion.generated_config,
          null, // No auth token for hosted servers
          result.project.description
        );
        serverId = serverResult.insertId;

        // Add creator as member
        await queries.addServerMember.run(serverId, result.user.id);
      }

      // Update project with deployment info
      await queries.updateAiServerProject.run(projectId, {
        status: 'deployed',
        hosting_type: 'parasharkgod',
        deployed_server_id: serverId
      });

      const updatedProject = await queries.selectAiServerProjectById.get(projectId);

      return res.json({
        project: updatedProject,
        serverId,
        serverUrl,
        message: "Server deployed to parasharkgod! It's now available in your servers list."
      });
    } catch (error) {
      console.error("Error deploying to parasharkgod:", error);
      return res.status(500).json({ error: "Failed to deploy server" });
    }
  });

  // GET /api/ai-servers/:id/download - Download for self-hosting
  router.get("/api/ai-servers/:id/download", async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    const result = await requireProjectOwner(req, res, projectId);
    if (!result) return;

    if (!result.project.live_version_id) {
      return res.status(400).json({ error: "No live version set. Accept a version first." });
    }

    try {
      const liveVersion = await queries.selectAiServerVersionById.get(result.project.live_version_id);
      if (!liveVersion) {
        return res.status(400).json({ error: "Live version not found" });
      }

      // Create ZIP file
      const zip = new JSZip();

      // Add main handler
      zip.file("api/index.js", liveVersion.generated_code);

      // Add package.json
      const packageJson = {
        name: result.project.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        version: "1.0.0",
        description: result.project.description || "Parascene AI-generated server",
        dependencies: {
          "sharp": "^0.33.0"
        }
      };
      zip.file("package.json", JSON.stringify(packageJson, null, 2));

      // Add vercel.json
      const vercelJson = {
        version: 2,
        builds: [
          { src: "api/index.js", use: "@vercel/node" }
        ],
        routes: [
          { src: "/api", dest: "/api/index.js" }
        ]
      };
      zip.file("vercel.json", JSON.stringify(vercelJson, null, 2));

      // Add README
      const readme = `# ${result.project.name}

${result.project.description || 'An AI-generated image generation server for Parascene.'}

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Set up environment variables:
   \`\`\`bash
   export API_KEY="your-secret-api-key"
   \`\`\`

3. Deploy to Vercel:
   \`\`\`bash
   vercel deploy
   \`\`\`

4. Set the API_KEY environment variable in Vercel:
   \`\`\`bash
   vercel env add API_KEY
   \`\`\`

5. Register the server at https://parasharkgod.com/servers using:
   - Server URL: https://your-project.vercel.app/api
   - Auth Token: your-secret-api-key

## Local Development

\`\`\`bash
vercel dev
\`\`\`

## Generated by Parascene AI Server Generator
`;
      zip.file("README.md", readme);

      // Generate ZIP buffer
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

      const filename = `${result.project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-server.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', zipBuffer.length);

      return res.send(zipBuffer);
    } catch (error) {
      console.error("Error generating download:", error);
      return res.status(500).json({ error: "Failed to generate download" });
    }
  });

  // POST /api/ai-servers/:id/fork - Fork to new project
  router.post("/api/ai-servers/:id/fork", async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    const result = await requireProjectOwner(req, res, projectId);
    if (!result) return;

    const { name } = req.body;
    const newName = name?.trim() || `${result.project.name} (Fork)`;

    try {
      // Create new project
      const newProjectResult = await queries.insertAiServerProject.run(
        result.user.id,
        newName,
        result.project.description
      );

      // If there's a live version, copy it
      if (result.project.live_version_id) {
        const liveVersion = await queries.selectAiServerVersionById.get(result.project.live_version_id);
        if (liveVersion) {
          await queries.insertAiServerVersion.run(
            newProjectResult.insertId,
            1,
            liveVersion.user_prompt,
            null,
            liveVersion.generated_code,
            liveVersion.generated_config,
            0, // No cost for forked versions
            null
          );

          // Mark as accepted (since it was already paid for)
          const newVersion = await queries.selectLatestAiServerVersion.get(newProjectResult.insertId);
          if (newVersion) {
            await queries.updateAiServerVersionStatus.run(newVersion.id, 'accepted', null);
            await queries.updateAiServerProject.run(newProjectResult.insertId, {
              status: 'ready',
              live_version_id: newVersion.id
            });
          }
        }
      }

      const newProject = await queries.selectAiServerProjectById.get(newProjectResult.insertId);
      return res.status(201).json({ project: newProject });
    } catch (error) {
      console.error("Error forking project:", error);
      return res.status(500).json({ error: "Failed to fork project" });
    }
  });

  // PUT /api/ai-servers/:id/branding - Update banner/icon
  router.put("/api/ai-servers/:id/branding", async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    const result = await requireProjectOwner(req, res, projectId);
    if (!result) return;

    const { banner_url, icon_url } = req.body;
    const updates = {};

    if (banner_url !== undefined) {
      updates.banner_url = banner_url?.trim() || null;
    }
    if (icon_url !== undefined) {
      updates.icon_url = icon_url?.trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No branding updates provided" });
    }

    try {
      await queries.updateAiServerProject.run(projectId, updates);
      const project = await queries.selectAiServerProjectById.get(projectId);
      return res.json({ project });
    } catch (error) {
      console.error("Error updating branding:", error);
      return res.status(500).json({ error: "Failed to update branding" });
    }
  });

  // GET /api/ai-servers/:id/royalties - Get royalty history
  router.get("/api/ai-servers/:id/royalties", async (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    const result = await requireProjectOwner(req, res, projectId);
    if (!result) return;

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;

    try {
      const royalties = await queries.selectAiServerRoyalties.all(projectId, { limit, offset });
      const stats = await queries.selectAiServerRoyaltyStats.get(projectId);
      return res.json({ royalties, stats });
    } catch (error) {
      console.error("Error fetching royalties:", error);
      return res.status(500).json({ error: "Failed to fetch royalties" });
    }
  });

  return router;
}
