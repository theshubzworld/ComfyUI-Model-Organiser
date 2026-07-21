-- ============================================================
-- SimplePod — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- Model cache: stores fetched sizes and resolved filenames
CREATE TABLE IF NOT EXISTS model_cache (
  clean_url   TEXT PRIMARY KEY,
  size        TEXT,
  name        TEXT,
  folder      TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Model list: stores the full model list (seeded from master-model-list.txt)
CREATE TABLE IF NOT EXISTS model_list (
  id          TEXT PRIMARY KEY,
  url         TEXT NOT NULL,
  name        TEXT,
  folder      TEXT DEFAULT 'checkpoints',
  size        TEXT,
  source      TEXT DEFAULT 'file',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast URL lookups
CREATE INDEX IF NOT EXISTS idx_model_list_url ON model_list (url);
CREATE INDEX IF NOT EXISTS idx_model_cache_url ON model_cache (clean_url);

-- Enable Row Level Security (RLS) - service_role key bypasses this
ALTER TABLE model_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_list  ENABLE ROW LEVEL SECURITY;

-- Allow full access via service_role key (used server-side in Vercel functions)
CREATE POLICY "service_role_all_cache" ON model_cache FOR ALL USING (true);
CREATE POLICY "service_role_all_list"  ON model_list  FOR ALL USING (true);
