import express from "express";

export default function createProviderRoutes({ queries }) {
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

  router.get("/api/provider/status", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;

    const statuses = await queries.selectProviderStatuses.all();
    return res.json({ statuses });
  });

  router.get("/api/provider/metrics", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;

    const metrics = await queries.selectProviderMetrics.all();
    return res.json({ metrics });
  });

  router.get("/api/provider/grants", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;

    const grants = await queries.selectProviderGrants.all();
    return res.json({ grants });
  });

  router.get("/api/provider/templates-hosted", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;

    const templates = await queries.selectProviderTemplates.all();
    return res.json({ templates });
  });

  return router;
}
