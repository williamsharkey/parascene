import { openDb as openMockDb } from "./adapters/mock.js";
import { openDb as openSupabaseDb } from "./adapters/supabase.js";
import { seedDatabase } from "./seed.js";

async function openDb(options = {}) {
  const { quiet = false } = options;
  const log = quiet ? () => {} : console.log;

  // Determine which adapter to use based on environment
  if (process.env.VERCEL) {
    log("Using mock database for Vercel deployment.");
    const dbInstance = openMockDb();
    await seedDatabase(dbInstance);
    return dbInstance;
  }

  // Use DB_ADAPTER environment variable to switch adapters
  // Default to sqlite if not specified
  const adapter = process.env.DB_ADAPTER || "sqlite";

  switch (adapter) {
    case "supabase":
      log("Using Supabase adapter.");
      return openSupabaseDb();
    case "mock":
      log("Using mock database adapter.");
      {
        const dbInstance = openMockDb();
        await seedDatabase(dbInstance);
        return dbInstance;
      }
    case "sqlite":
    default:
      log("Using SQLite adapter.");
      // Dynamically import SQLite adapter only when needed (not in production/Vercel)
      const { openDb: openSqliteDb } = await import("./adapters/sqlite.js");
      return openSqliteDb();
  }
}

export { openDb };

