import express from "express";
import bcrypt from "bcryptjs";

export default function createProfileRoutes({ queries }) {
  const router = express.Router();

  router.post("/signup", (req, res) => {
    const email = String(req.body.username || req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).send("Email and password are required.");
    }

    if (queries.selectUserByEmail.get(email)) {
      return res.status(409).send("Email already registered.");
    }

    const passwordHash = bcrypt.hashSync(password, 12);
    const info = queries.insertUser.run(email, passwordHash, "consumer");
    req.session.userId = info.lastInsertRowid;

    return res.redirect("/");
  });

  router.post("/login", (req, res) => {
    const email = String(req.body.username || req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).send("Email and password are required.");
    }

    const user = queries.selectUserByEmail.get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.redirect("/#auth-fail");
    }

    req.session.userId = user.id;
    return res.redirect("/");
  });

  router.post("/logout", (req, res) => {
    req.session.destroy(() => {
      res.redirect("/");
    });
  });

  router.get("/me", (req, res) => {
    res.json({ userId: req.session.userId || null });
  });

  router.get("/api/profile", (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = queries.selectUserById.get(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(user);
  });

  router.get("/api/notifications", (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = queries.selectUserById.get(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const notifications = queries.selectNotificationsForUser.all(
      user.id,
      user.role
    );
    return res.json({ notifications });
  });

  router.get("/api/notifications/unread-count", (req, res) => {
    if (!req.session.userId) {
      return res.json({ count: 0 });
    }

    const user = queries.selectUserById.get(req.session.userId);
    if (!user) {
      return res.json({ count: 0 });
    }

    const result = queries.selectUnreadNotificationCount.get(
      user.id,
      user.role
    );
    return res.json({ count: result?.count ?? 0 });
  });

  router.post("/api/notifications/acknowledge", (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = queries.selectUserById.get(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const id = Number(req.body?.id);
    if (!id) {
      return res.status(400).json({ error: "Notification id required" });
    }

    const result = queries.acknowledgeNotificationById.run(
      id,
      user.id,
      user.role
    );
    return res.json({ ok: true, updated: result.changes });
  });

  return router;
}
