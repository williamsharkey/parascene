import { openDb as openSqliteDb } from "./adapters/sqlite.js";
import { openDb as openMockDb } from "./adapters/mock.js";
import { openDb as openSupabaseDb } from "./adapters/supabase.js";

function openDb() {
  // Determine which adapter to use based on environment
  if (process.env.VERCEL) {
    console.log("Using mock database for Vercel deployment.");
    return openMockDb();
  }

  // Use DB_ADAPTER environment variable to switch adapters
  // Default to sqlite if not specified
  const adapter = process.env.DB_ADAPTER || "sqlite";

  switch (adapter) {
    case "supabase":
      console.log("Using Supabase adapter.");
      return openSupabaseDb();
    case "mock":
      console.log("Using mock database adapter.");
      return openMockDb();
    case "sqlite":
    default:
      console.log("Using SQLite adapter.");
      return openSqliteDb();
  }
}

export { openDb };
