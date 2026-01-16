import express from "express";

export default function createTemplatesRoutes({ queries }) {
  const router = express.Router();

  router.get("/api/templates", (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = queries.selectUserById.get(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const templates = queries.selectTemplates.all();
    return res.json({ templates });
  });

  return router;
}
