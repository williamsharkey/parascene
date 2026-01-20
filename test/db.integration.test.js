import { describe, it, expect, beforeAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// All tables that should exist according to the schema
const expectedTables = [
  'prsn_users',
  'prsn_sessions',
  'prsn_moderation_queue',
  'prsn_provider_registry',
  'prsn_provider_statuses',
  'prsn_provider_metrics',
  'prsn_provider_grants',
  'prsn_provider_templates',
  'prsn_policy_knobs',
  'prsn_notifications',
  'prsn_explore_items',
  'prsn_creations',
  'prsn_servers',
  'prsn_templates',
  'prsn_created_images',
  'prsn_feed_items'
];

describe('Database Integration Tests', () => {
  let supabase;

  beforeAll(() => {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Missing required environment variables: SUPABASE_URL and/or SUPABASE_ANON_KEY. ' +
        'Please ensure these are set in your .env file.'
      );
    }
    supabase = createClient(supabaseUrl, supabaseKey);
  });

  describe('Table Existence Checks', () => {
    it('should have all required tables created', async () => {
      const missingTables = [];
      const existingTables = [];

      // Check each table by attempting to query it
      for (const tableName of expectedTables) {
        try {
          // Try to select from the table (limit 0 to avoid fetching data)
          const { error } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });

          if (error) {
            // If we get a specific error about the table not existing, mark it as missing
            if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
              missingTables.push(tableName);
            } else {
              // Other errors might indicate the table exists but has issues
              // For now, we'll consider it existing if it's not a "does not exist" error
              existingTables.push(tableName);
            }
          } else {
            existingTables.push(tableName);
          }
        } catch (err) {
          // If we get an exception, assume the table doesn't exist
          missingTables.push(tableName);
        }
      }

      // Report results
      if (missingTables.length > 0) {
        console.error('Missing tables:', missingTables);
        console.log('Existing tables:', existingTables);
      }

      expect(missingTables).toHaveLength(0);
      expect(existingTables).toHaveLength(expectedTables.length);
    });

    it('should verify each table individually', async () => {
      for (const tableName of expectedTables) {
        const { error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        expect(error).toBeNull();
      }
    });
  });
});
