import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import { openDb } from "../db/index.js";
import createAdminRoutes from "./admin.js";
import createExploreRoutes from "./explore.js";
import createFeedRoutes from "./feed.js";
import createPostsRoutes from "./posts.js";
import createPageRoutes from "./pages.js";
import createProviderRoutes from "./provider.js";
import createServersRoutes from "./servers.js";
import createTemplatesRoutes from "./templates.js";
import createUserRoutes from "./user.js";

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pagesDir = path.join(__dirname, "..", "pages");
const staticDir = path.join(__dirname, "..", "static");
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
app.use(createUserRoutes({ queries }));

app.use(createAdminRoutes({ queries }));
app.use(createFeedRoutes({ queries }));
app.use(createExploreRoutes({ queries }));
app.use(createPostsRoutes({ queries }));
app.use(createProviderRoutes({ queries }));
app.use(createServersRoutes({ queries }));
app.use(createTemplatesRoutes({ queries }));
app.use(createPageRoutes({ queries, pagesDir }));

if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`Parascene dev server running on http://localhost:${port}`);
  });
}

export default app;
