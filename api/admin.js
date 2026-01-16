import express from "express";

export default function createAdminRoutes({ queries }) {
  const router = express.Router();

  router.get("/admin/users", (req, res) => {
    const users = queries.selectUsers.all();
    res.json({ users });
  });

  router.get("/admin/moderation", (req, res) => {
    const items = queries.selectModerationQueue.all();
    res.json({ items });
  });

  router.get("/admin/providers", (req, res) => {
    const providers = queries.selectProviders.all();
    res.json({ providers });
  });

  router.get("/admin/policies", (req, res) => {
    const policies = queries.selectPolicies.all();
    res.json({ policies });
  });

  return router;
}
