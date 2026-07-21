/**
 * api/_db.js — Shared Supabase client
 * Used by all /api/* Vercel serverless functions.
 */
import { createClient } from '@supabase/supabase-js';

let _client = null;

export function getDb() {
  if (!_client) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    if (!url || !key) {
      console.warn('[db] Supabase environment variables missing. Database operations skipped.');
      return null;
    }
    _client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return _client;
}

/** Strip token query param from URL to use as a clean, consistent cache key. */
export function cleanUrl(url) {
  if (!url) return url;
  return url
    .replace('civitai.red', 'civitai.com')
    .replace(/[?&]token=[a-zA-Z0-9_-]+/g, '')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');
}

const isPlaceholder = (n) =>
  !n || /^\d+$/.test(String(n)) || String(n).startsWith('civitai_');

/**
 * Upsert a row into model_cache.
 * Only updates fields that are provided and non-placeholder.
 */
export async function upsertCache(db, url, { size, name, folder } = {}) {
  if (!db) return;
  const key = cleanUrl(url);
  if (!key) return;

  const row = { clean_url: key };
  if (size && size !== 'Unknown') row.size = size;
  if (name && !isPlaceholder(name)) row.name = name;
  if (folder) row.folder = folder;

  if (Object.keys(row).length === 1) return; // nothing to upsert

  try {
    const { error } = await db
      .from('model_cache')
      .upsert(row, { onConflict: 'clean_url', ignoreDuplicates: false });

    if (error) console.warn('[cache] upsert error:', error.message);
  } catch (err) {
    console.warn('[cache] Exception during upsert:', err.message);
  }
}
