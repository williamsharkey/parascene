import express from "express";
import path from "path";
import { clearAuthCookie } from "./auth.js";

function getPageForUser(user) {
  const roleToPage = {
    consumer: "consumer.html",
    creator: "creator.html",
    provider: "provider.html",
    admin: "admin.html"
  };
  return roleToPage[user.role] || "consumer.html";
}

export default function createPageRoutes({ queries, pagesDir }) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.sendFile(path.join(pagesDir, "auth.html"));
    }

    const user = await queries.selectUserById.get(userId);
    if (!user) {
      clearAuthCookie(res);
      res.sendFile(path.join(pagesDir, "auth.html"));
      return;
    }

    const page = getPageForUser(user);
    return res.sendFile(path.join(pagesDir, page));
  });

  // Catch-all route for sub-routes - serve the same page for all routes
  // This allows clean URLs like /feed, /explore, etc. while serving the same HTML
  // Must come after API routes but will be handled by static middleware first for actual files
  router.get("/*", async (req, res, next) => {
    // Skip if it's an API route, static file, or known endpoint
    if (req.path.startsWith("/api/") ||
        req.path.startsWith("/admin/users") ||
        req.path === "/me" ||
        req.path === "/signup" ||
        req.path === "/login" ||
        req.path === "/logout") {
      return next(); // Let other routes handle it or 404
    }

    // Check if it's a static file request (Express static middleware handles this)
    // If we get here, it's likely a route that should serve the page
    const userId = req.auth?.userId;
    if (!userId) {
      return res.sendFile(path.join(pagesDir, "auth.html"));
    }

    const user = await queries.selectUserById.get(userId);
    if (!user) {
      clearAuthCookie(res);
      res.sendFile(path.join(pagesDir, "auth.html"));
      return;
    }

    // Serve the same page for all routes - client-side routing handles the rest
    const page = getPageForUser(user);
    return res.sendFile(path.join(pagesDir, page));
  });

  return router;
}
