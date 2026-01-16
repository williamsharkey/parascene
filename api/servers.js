import express from "express";

export default function createServersRoutes({ queries }) {
  const router = express.Router();

  router.get("/api/servers", (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = queries.selectUserById.get(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const servers = queries.selectServers.all();
    return res.json({ servers });
  });

  return router;
}
