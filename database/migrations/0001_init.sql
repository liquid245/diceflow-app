-- 0001_init.sql — initial DiceFlow analytics schema.
-- Applied with: npx wrangler d1 migrations apply diceflow-analytics --remote

CREATE TABLE IF NOT EXISTS installations (
  installation_id TEXT PRIMARY KEY,
  first_seen      INTEGER NOT NULL,
  last_seen       INTEGER NOT NULL,
  platform        TEXT,
  version         TEXT,
  country         TEXT,
  region          TEXT,
  city            TEXT,
  latitude        REAL,
  longitude       REAL
);

CREATE INDEX IF NOT EXISTS idx_installations_last_seen ON installations (last_seen);
CREATE INDEX IF NOT EXISTS idx_installations_first_seen ON installations (first_seen);

CREATE TABLE IF NOT EXISTS events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  installation_id  TEXT NOT NULL,
  session_id       TEXT NOT NULL,
  type             TEXT NOT NULL,
  properties       TEXT,
  client_timestamp INTEGER,
  server_timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_server_timestamp ON events (server_timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON events (type, server_timestamp);
CREATE INDEX IF NOT EXISTS idx_events_installation ON events (installation_id, server_timestamp);
