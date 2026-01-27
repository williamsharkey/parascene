#!/usr/bin/env node
// Migration script to apply schema to Supabase
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const PROJECT_REF = process.env.PROJECT_REF || 'hydtntbgdwbkxirsftar';

if (!SUPABASE_DB_PASSWORD) {
  console.error('Error: SUPABASE_DB_PASSWORD environment variable is required');
  process.exit(1);
}

// Session pooler (port 5432) - supports prepared statements
const connectionString = `postgresql://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`;

async function migrate() {
  console.log('Connecting to Supabase database...');

  const sql = postgres(connectionString, {
    ssl: 'require',
    connection: {
      application_name: 'parascene-migrate'
    }
  });

  try {
    // Test connection
    const testResult = await sql`SELECT current_database(), current_user`;
    console.log('Connected to:', testResult[0].current_database, 'as', testResult[0].current_user);

    // Read the schema file
    const schemaPath = path.join(__dirname, 'schemas', 'supabase_01.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running migration...');

    // Execute the schema (postgres.js handles multi-statement SQL)
    await sql.unsafe(schema);

    console.log('Migration completed successfully!');

    // Verify tables were created
    const result = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'prsn_%'
      ORDER BY table_name
    `;

    console.log(`\nCreated ${result.length} tables:`);
    result.forEach(row => console.log(`  - ${row.table_name}`));

  } catch (error) {
    console.error('Migration failed:', error.message);
    if (error.code) console.error('Error code:', error.code);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
