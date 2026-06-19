PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_original TEXT,
  aliases_json TEXT,
  series TEXT,
  language TEXT,
  year TEXT,
  summary_short TEXT NOT NULL,
  summary_full TEXT,
  tags_json TEXT,
  source_primary TEXT NOT NULL,
  record_status TEXT NOT NULL DEFAULT 'draft',
  visibility TEXT NOT NULL DEFAULT 'public',
  rights_note TEXT,
  editor TEXT,
  reviewer TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS releases (
  release_id TEXT PRIMARY KEY,
  parent_work_id TEXT NOT NULL,
  release_title TEXT,
  release_date TEXT,
  edition TEXT,
  episode_count INTEGER,
  duration TEXT,
  file_size TEXT,
  resolution TEXT,
  audio_tracks_json TEXT,
  subtitle_tracks_json TEXT,
  cover_variant_id TEXT,
  quality_note TEXT,
  release_status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS access_entries (
  access_id TEXT PRIMARY KEY,
  parent_release_id TEXT NOT NULL,
  access_type TEXT NOT NULL,
  platform TEXT,
  url TEXT,
  availability TEXT,
  access_note TEXT,
  last_verified TEXT,
  mirror_note TEXT,
  access_risk TEXT,
  checksum TEXT,
  extract_code TEXT,
  internal_path TEXT,
  sensitive_source TEXT,
  visibility TEXT NOT NULL DEFAULT 'restricted',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (parent_release_id) REFERENCES releases(release_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contributors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  credit_name TEXT,
  note TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS covers (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  release_id TEXT,
  url TEXT NOT NULL,
  source TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  process_note TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
  FOREIGN KEY (release_id) REFERENCES releases(release_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS taxonomies (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS taxonomy_terms (
  id TEXT PRIMARY KEY,
  taxonomy_id TEXT NOT NULL,
  parent_id TEXT,
  label TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (taxonomy_id) REFERENCES taxonomies(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES taxonomy_terms(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS work_taxonomy_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id TEXT NOT NULL,
  term_id TEXT NOT NULL,
  relation_type TEXT NOT NULL DEFAULT 'tag',
  confidence TEXT NOT NULL DEFAULT 'manual',
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
  FOREIGN KEY (term_id) REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
  UNIQUE(work_id, term_id, relation_type)
);

CREATE TABLE IF NOT EXISTS work_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_work_id TEXT NOT NULL,
  target_work_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'directed',
  note TEXT,
  confidence TEXT NOT NULL DEFAULT 'manual',
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (source_work_id) REFERENCES works(id) ON DELETE CASCADE,
  FOREIGN KEY (target_work_id) REFERENCES works(id) ON DELETE CASCADE,
  CHECK (source_work_id != target_work_id),
  UNIQUE(source_work_id, target_work_id, relation_type)
);

CREATE TABLE IF NOT EXISTS external_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  title TEXT,
  url TEXT,
  relation_type TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id TEXT NOT NULL,
  source_type TEXT,
  url TEXT,
  title TEXT,
  evidence_level TEXT,
  note TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  last_checked TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_works_title ON works(title);
CREATE INDEX IF NOT EXISTS idx_releases_parent_work ON releases(parent_work_id);
CREATE INDEX IF NOT EXISTS idx_access_parent_release ON access_entries(parent_release_id);
CREATE INDEX IF NOT EXISTS idx_terms_taxonomy ON taxonomy_terms(taxonomy_id);
CREATE INDEX IF NOT EXISTS idx_relations_source ON work_relations(source_work_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON work_relations(target_work_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
