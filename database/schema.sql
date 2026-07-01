-- HanGraph vocabulary database schema
-- SQLite-compatible; used for local collection and export to app bundles.

PRAGMA foreign_keys = ON;

-- External source catalog (see database/sources.json for metadata)
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  license TEXT,
  imported_at TEXT
);

-- Semantic / curriculum categories (HSK level, radical, topic, character family)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,          -- hsk | radical | character_root | topic | grammar
  name_en TEXT NOT NULL,
  name_th TEXT,
  parent_id TEXT REFERENCES categories(id),
  hsk_level INTEGER,
  sort_order INTEGER DEFAULT 0
);

-- Vocabulary entries
CREATE TABLE IF NOT EXISTS words (
  id TEXT PRIMARY KEY,         -- simplified + pinyin slug, or simplified if unique
  simplified TEXT NOT NULL,
  traditional TEXT NOT NULL,
  pinyin TEXT NOT NULL,
  pinyin_numbered TEXT,
  english TEXT NOT NULL,
  thai TEXT,
  hsk_level INTEGER NOT NULL,
  radical TEXT,
  pos TEXT,                    -- part of speech tags, comma-separated
  frequency_rank INTEGER,
  source_id TEXT REFERENCES sources(id),
  UNIQUE(simplified, pinyin)
);

-- First-class character nodes for overview sphere
CREATE TABLE IF NOT EXISTS characters (
  char TEXT PRIMARY KEY,
  traditional TEXT,
  english TEXT NOT NULL,
  thai TEXT,
  min_hsk INTEGER NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  sample_word_id TEXT REFERENCES words(id),
  radical TEXT
);

-- Word ↔ category membership (many-to-many)
CREATE TABLE IF NOT EXISTS word_categories (
  word_id TEXT NOT NULL REFERENCES words(id),
  category_id TEXT NOT NULL REFERENCES categories(id),
  PRIMARY KEY (word_id, category_id)
);

-- Explicit vocabulary graph edges (optional; runtime can also derive shared-char links)
CREATE TABLE IF NOT EXISTS word_relations (
  id TEXT PRIMARY KEY,
  source_word_id TEXT NOT NULL REFERENCES words(id),
  target_word_id TEXT NOT NULL REFERENCES words(id),
  relation_type TEXT NOT NULL, -- shared_char | compound | synonym | antonym | topic
  label TEXT,                  -- e.g. shared character 打
  weight REAL DEFAULT 1.0,
  UNIQUE(source_word_id, target_word_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_words_hsk ON words(hsk_level);
CREATE INDEX IF NOT EXISTS idx_words_simplified ON words(simplified);
CREATE INDEX IF NOT EXISTS idx_characters_min_hsk ON characters(min_hsk);
CREATE INDEX IF NOT EXISTS idx_word_relations_source ON word_relations(source_word_id);
CREATE INDEX IF NOT EXISTS idx_word_relations_target ON word_relations(target_word_id);
