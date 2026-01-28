-- AI Server Projects schema extension for Parascene

-- AI server projects (main entity)
CREATE TABLE IF NOT EXISTS ai_server_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft', -- draft, ready, deployed
  hosting_type TEXT, -- 'self', 'parasharkgod'
  live_version_id INTEGER,
  deployed_server_id INTEGER REFERENCES servers(id),
  banner_url TEXT,
  icon_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_server_projects_user_id
  ON ai_server_projects(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_server_projects_status
  ON ai_server_projects(status);

-- Version history for refinements
CREATE TABLE IF NOT EXISTS ai_server_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES ai_server_projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  parent_version_id INTEGER,
  user_prompt TEXT NOT NULL,
  refinement_prompt TEXT,
  generated_code TEXT NOT NULL,
  generated_config TEXT, -- JSON
  generation_cost REAL NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, testing, accepted, rejected
  test_result TEXT, -- JSON
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_server_versions_project_id
  ON ai_server_versions(project_id);

CREATE INDEX IF NOT EXISTS idx_ai_server_versions_status
  ON ai_server_versions(status);

-- Royalty tracking for hosted servers
CREATE TABLE IF NOT EXISTS ai_server_royalties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES ai_server_projects(id),
  created_image_id INTEGER,
  credits_charged REAL NOT NULL,
  creator_share REAL NOT NULL, -- 50%
  platform_share REAL NOT NULL, -- 50%
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_server_royalties_project_id
  ON ai_server_royalties(project_id);

CREATE INDEX IF NOT EXISTS idx_ai_server_royalties_created_at
  ON ai_server_royalties(created_at);
