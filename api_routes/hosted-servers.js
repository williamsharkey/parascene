import express from "express";
import { executeRequest } from "../services/sandbox-runner.js";

// Royalty split constants
const CREATOR_SHARE_PERCENT = 50;
const PLATFORM_SHARE_PERCENT = 50;

export default function createHostedServersRoutes({ queries }) {
  const router = express.Router();

  /**
   * GET /api/hosted/:projectId
   * Returns capabilities for a hosted AI server
   */
  router.get("/api/hosted/:projectId", async (req, res) => {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    try {
      // Get the project
      const project = await queries.selectAiServerProjectById.get(projectId);
      if (!project) {
        return res.status(404).json({ error: "Server not found" });
      }

      if (project.status !== 'deployed' || project.hosting_type !== 'parasharkgod') {
        return res.status(404).json({ error: "Server not available" });
      }

      if (!project.live_version_id) {
        return res.status(500).json({ error: "Server has no live version" });
      }

      // Get the live version
      const version = await queries.selectAiServerVersionById.get(project.live_version_id);
      if (!version || !version.generated_code) {
        return res.status(500).json({ error: "Server code not found" });
      }

      // Execute GET request in sandbox
      const result = await executeRequest(
        version.generated_code,
        'GET',
        { authorization: `Bearer ${process.env.HOSTED_SERVER_INTERNAL_KEY || 'internal'}` },
        null
      );

      if (!result.success) {
        return res.status(500).json({ error: "Failed to get server capabilities" });
      }

      // Parse and return the capabilities
      try {
        const capabilities = JSON.parse(result.body.toString());

        // Override with project branding if available
        if (project.icon_url) {
          capabilities.icon = project.icon_url;
        }
        if (project.banner_url) {
          capabilities.banner = project.banner_url;
        }
        capabilities.name = project.name;
        capabilities.description = project.description || capabilities.description;

        return res.json(capabilities);
      } catch (parseError) {
        console.error("Failed to parse hosted server capabilities:", parseError);
        return res.status(500).json({ error: "Invalid server response" });
      }
    } catch (error) {
      console.error("Error getting hosted server capabilities:", error);
      return res.status(500).json({ error: "Failed to get server capabilities" });
    }
  });

  /**
   * POST /api/hosted/:projectId
   * Generates an image using the hosted AI server
   * Tracks royalties for the creator
   */
  router.post("/api/hosted/:projectId", async (req, res) => {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    try {
      // Get the project
      const project = await queries.selectAiServerProjectById.get(projectId);
      if (!project) {
        return res.status(404).json({ error: "Server not found" });
      }

      if (project.status !== 'deployed' || project.hosting_type !== 'parasharkgod') {
        return res.status(404).json({ error: "Server not available" });
      }

      if (!project.live_version_id) {
        return res.status(500).json({ error: "Server has no live version" });
      }

      // Get the live version
      const version = await queries.selectAiServerVersionById.get(project.live_version_id);
      if (!version || !version.generated_code) {
        return res.status(500).json({ error: "Server code not found" });
      }

      // Execute POST request in sandbox
      const result = await executeRequest(
        version.generated_code,
        'POST',
        {
          authorization: `Bearer ${process.env.HOSTED_SERVER_INTERNAL_KEY || 'internal'}`,
          'content-type': 'application/json'
        },
        req.body
      );

      if (!result.success) {
        return res.status(500).json({ error: "Failed to generate image" });
      }

      // Forward the response headers
      if (result.headers) {
        for (const [key, value] of Object.entries(result.headers)) {
          res.setHeader(key, value);
        }
      }

      // Send the image data
      res.status(result.statusCode || 200);
      return res.send(result.body);
    } catch (error) {
      console.error("Error executing hosted server:", error);
      return res.status(500).json({ error: "Failed to generate image" });
    }
  });

  /**
   * Internal function to record royalties after successful generation
   * Called by the main create endpoint after charging credits
   */
  router.recordRoyalty = async function(projectId, createdImageId, creditsCharged) {
    try {
      const creatorShare = (creditsCharged * CREATOR_SHARE_PERCENT) / 100;
      const platformShare = (creditsCharged * PLATFORM_SHARE_PERCENT) / 100;

      await queries.insertAiServerRoyalty.run(
        projectId,
        createdImageId,
        creditsCharged,
        creatorShare,
        platformShare
      );

      // Credit the creator's account
      const project = await queries.selectAiServerProjectById.get(projectId);
      if (project?.user_id) {
        await queries.updateUserCreditsBalance.run(project.user_id, creatorShare);
      }

      return { creatorShare, platformShare };
    } catch (error) {
      console.error("Error recording royalty:", error);
      return null;
    }
  };

  return router;
}
