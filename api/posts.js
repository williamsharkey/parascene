import express from "express";

export default function createPostsRoutes({ queries }) {
  const router = express.Router();

  router.get("/api/posts", (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = queries.selectUserById.get(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const posts = queries.selectPostsForUser.all(user.id);
    return res.json({ posts });
  });

  return router;
}
