import express from "express";

export default function createExploreRoutes({ queries }) {
  const router = express.Router();

  router.get("/api/explore", (req, res) => {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = queries.selectUserById.get(req.auth?.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const items = queries.selectExploreItems.all();
    return res.json({ items });
  });

  return router;
}
