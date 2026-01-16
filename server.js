import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import { openDb } from "./db/index.js";

const app = express();
const port = process.env.PORT;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pagesDir = path.join(__dirname, "pages");
const staticDir = path.join(__dirname, "static");
const { queries } = openDb();

app.use(express.static(staticDir));
app.use(express.static(pagesDir));
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true }
  })
);

app.use((req, res, next) => {
  res.locals.userId = req.session.userId || null;
  next();
});

// Helper function to get the appropriate page for a user
function getPageForUser(user) {
  const roleToPage = {
    consumer: "consumer.html",
    creator: "creator.html",
    provider: "provider.html",
    admin: "admin.html"
  };
  return roleToPage[user.role] || "consumer.html";
}

app.get("/", (req, res) => {
  if (!req.session.userId) {
    return res.sendFile(path.join(pagesDir, "auth.html"));
  }

  const user = queries.selectUserById.get(req.session.userId);
  if (!user) {
    req.session.destroy(() => {
      res.sendFile(path.join(pagesDir, "auth.html"));
    });
    return;
  }

  const page = getPageForUser(user);
  return res.sendFile(path.join(pagesDir, page));
});


app.post("/signup", (req, res) => {
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

app.post("/login", (req, res) => {
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

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.get("/me", (req, res) => {
  res.json({ userId: req.session.userId || null });
});

app.get("/api/profile", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = queries.selectUserById.get(req.session.userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json(user);
});

app.get("/admin/users", (req, res) => {
  const users = queries.selectUsers.all();
  res.json({ users });
});

// Catch-all route for sub-routes - serve the same page for all routes
// This allows clean URLs like /feed, /explore, etc. while serving the same HTML
// Must come after API routes but will be handled by static middleware first for actual files
app.get("/*", (req, res, next) => {
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
  if (!req.session.userId) {
    return res.sendFile(path.join(pagesDir, "auth.html"));
  }

  const user = queries.selectUserById.get(req.session.userId);
  if (!user) {
    req.session.destroy(() => {
      res.sendFile(path.join(pagesDir, "auth.html"));
    });
    return;
  }

  // Serve the same page for all routes - client-side routing handles the rest
  const page = getPageForUser(user);
  return res.sendFile(path.join(pagesDir, page));
});

app.listen(port, () => {
  console.log(`Parascene dev server running on http://localhost:${port}`);
});
