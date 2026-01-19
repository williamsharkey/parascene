import express from "express";

export default function createExploreRoutes({ queries }) {
  const router = express.Router();

  router.get("/api/explore", async (req, res) => {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await queries.selectUserById.get(req.auth?.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const items = await queries.selectExploreItems.all();
    return res.json({ items });
  });

  return router;
}
