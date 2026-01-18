import { openDb } from "./index.js";

try {
  // Use adapter's reset method if available
  const { reset } = openDb();
  if (reset) {
    await reset();
  }

  await import("./seed.js");
  console.log("Database reset complete.");
} catch (error) {
  console.error("Database reset error:", error);
  process.exit(1);
}
