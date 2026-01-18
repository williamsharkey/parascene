import express from "express";

export default function createAdminRoutes({ queries }) {
  const router = express.Router();

  router.get("/admin/users", async (req, res) => {
    const users = await queries.selectUsers.all();
    res.json({ users });
  });

  router.get("/admin/moderation", async (req, res) => {
    const items = await queries.selectModerationQueue.all();
    res.json({ items });
  });

  router.get("/admin/providers", async (req, res) => {
    const providers = await queries.selectProviders.all();
    res.json({ providers });
  });

  router.get("/admin/policies", async (req, res) => {
    const policies = await queries.selectPolicies.all();
    res.json({ policies });
  });

  return router;
}
