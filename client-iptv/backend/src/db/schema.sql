-- iptv.db relational schema (BE-04 / issue #14).
--
-- Models the iptv-org datasets (resolved via @iptv-org/sdk) and their
-- relationships. N:M relations are modeled with bridge tables; small list
-- fields (alt_names, owners, tags, sources, ...) are stored as JSON text
-- columns to keep the schema compact.
--
-- This file is applied wholesale by the migration runner (src/db/migrate.ts).
-- Every statement uses `IF NOT EXISTS` so applying it repeatedly is a no-op.
-- The FTS5 virtual table lives in src/db/fts.ts (issue #16) so the schema can
-- be created even on builds without the FTS5 module; the ETL builds the index.

-- ---------------------------------------------------------------------------
-- Reference dimensions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS languages (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS countries (
  code      TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  flag      TEXT,
  -- JSON array of language codes spoken in the country.
  languages TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS regions (
  code      TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  -- JSON array of member country codes (also denormalized into region_countries).
  countries TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS subdivisions (
  code    TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  country TEXT,
  parent  TEXT
);

CREATE TABLE IF NOT EXISTS cities (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  country     TEXT,
  subdivision TEXT,
  wikidata_id TEXT
);

-- ---------------------------------------------------------------------------
-- Core entities
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS channels (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  -- JSON arrays.
  alt_names   TEXT NOT NULL DEFAULT '[]',
  network     TEXT,
  owners      TEXT NOT NULL DEFAULT '[]',
  country     TEXT,
  categories  TEXT NOT NULL DEFAULT '[]',
  is_nsfw     INTEGER NOT NULL DEFAULT 0,
  launched    TEXT,
  closed      TEXT,
  replaced_by TEXT,
  website     TEXT,
  -- Derived flags (resolved by the ETL).
  is_closed   INTEGER NOT NULL DEFAULT 0,
  is_blocked  INTEGER NOT NULL DEFAULT 0,
  -- Denormalized country name for display/filtering without a join.
  country_name TEXT
);

CREATE TABLE IF NOT EXISTS feeds (
  -- Composite identity: a feed is unique per (channel, id).
  channel        TEXT NOT NULL,
  id             TEXT NOT NULL,
  -- Stream id used by streams/guides: "<channel>@<id>".
  stream_id      TEXT NOT NULL,
  name           TEXT,
  alt_names      TEXT NOT NULL DEFAULT '[]',
  is_main        INTEGER NOT NULL DEFAULT 0,
  broadcast_area TEXT NOT NULL DEFAULT '[]',
  languages      TEXT NOT NULL DEFAULT '[]',
  timezones      TEXT NOT NULL DEFAULT '[]',
  format         TEXT,
  PRIMARY KEY (channel, id)
);

CREATE TABLE IF NOT EXISTS streams (
  -- iptv-org streams have no natural primary key, so we assign a row id.
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  channel    TEXT,
  feed       TEXT,
  title      TEXT,
  url        TEXT NOT NULL,
  referrer   TEXT,
  user_agent TEXT,
  quality    TEXT,
  label      TEXT
);

CREATE TABLE IF NOT EXISTS logos (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT,
  feed    TEXT,
  in_use  INTEGER NOT NULL DEFAULT 0,
  tags    TEXT NOT NULL DEFAULT '[]',
  width   INTEGER,
  height  INTEGER,
  format  TEXT,
  url     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guides (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  channel   TEXT,
  feed      TEXT,
  site      TEXT,
  site_id   TEXT,
  site_name TEXT,
  lang      TEXT,
  sources   TEXT NOT NULL DEFAULT '[]'
);

-- ---------------------------------------------------------------------------
-- Bridge tables (N:M)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS channel_categories (
  channel_id  TEXT NOT NULL,
  category_id TEXT NOT NULL,
  PRIMARY KEY (channel_id, category_id)
);

-- Languages a channel broadcasts in, derived from its feeds.
CREATE TABLE IF NOT EXISTS channel_languages (
  channel_id    TEXT NOT NULL,
  language_code TEXT NOT NULL,
  PRIMARY KEY (channel_id, language_code)
);

CREATE TABLE IF NOT EXISTS region_countries (
  region_code  TEXT NOT NULL,
  country_code TEXT NOT NULL,
  PRIMARY KEY (region_code, country_code)
);

-- ---------------------------------------------------------------------------
-- User state (favorites) — local to this personal client; not reset by the ETL.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS favorites (
  channel_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Indexes on filter/join keys
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_streams_channel ON streams (channel);
CREATE INDEX IF NOT EXISTS idx_streams_feed    ON streams (feed);
CREATE INDEX IF NOT EXISTS idx_feeds_channel   ON feeds (channel);
CREATE INDEX IF NOT EXISTS idx_feeds_stream_id ON feeds (stream_id);
CREATE INDEX IF NOT EXISTS idx_logos_channel   ON logos (channel);
CREATE INDEX IF NOT EXISTS idx_guides_channel  ON guides (channel);
CREATE INDEX IF NOT EXISTS idx_guides_site     ON guides (site);

CREATE INDEX IF NOT EXISTS idx_channels_country    ON channels (country);
CREATE INDEX IF NOT EXISTS idx_channels_is_blocked ON channels (is_blocked);
CREATE INDEX IF NOT EXISTS idx_channels_name       ON channels (name);

CREATE INDEX IF NOT EXISTS idx_cc_category       ON channel_categories (category_id);
CREATE INDEX IF NOT EXISTS idx_cl_language       ON channel_languages (language_code);
CREATE INDEX IF NOT EXISTS idx_rc_country        ON region_countries (country_code);

CREATE INDEX IF NOT EXISTS idx_subdivisions_country ON subdivisions (country);
CREATE INDEX IF NOT EXISTS idx_cities_country       ON cities (country);
CREATE INDEX IF NOT EXISTS idx_cities_subdivision   ON cities (subdivision);
