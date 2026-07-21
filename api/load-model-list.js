/**
 * api/load-model-list.js — Vercel Serverless Function
 * Loads all models from Supabase model_list table.
 * On first run (empty table), seeds from bundled data/master-model-list.txt.
 */
import { getDb, cleanUrl } from './db.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MASTER_LIST = join(__dirname, '..', 'data', 'master-model-list.txt');

function parseLine(line) {
  line = line.trim();
  if (!line || line.startsWith('#')) return null;
  const parts = line.split(/\s+/);
  if (parts.length < 2) return null;
  const url = parts[0];
  if (!url.startsWith('http')) return null;
  const folder = (parts[1] || 'checkpoints').replace(/^models\//i, '');
  const name = parts[2] || '';
  return { url, folder, name };
}

function modelId(url) {
  try { return Buffer.from(url).toString('base64').slice(0, 32); } catch { return url.slice(-32); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = getDb();

    // Check if model_list has rows
    const { count } = await db
      .from('model_list')
      .select('*', { count: 'exact', head: true });

    if ((count ?? 0) === 0 && existsSync(MASTER_LIST)) {
      // Seed from bundled file on first run
      console.log('[load-model-list] Seeding from master-model-list.txt...');
      const lines = readFileSync(MASTER_LIST, 'utf-8').split('\n');
      const rows = [];
      for (const line of lines) {
        const m = parseLine(line);
        if (!m) continue;
        rows.push({
          id: modelId(m.url),
          url: m.url,
          name: m.name || null,
          folder: m.folder,
          size: null,
          source: 'file',
        });
      }
      // Upsert in batches of 200
      for (let i = 0; i < rows.length; i += 200) {
        await db.from('model_list').upsert(rows.slice(i, i + 200), { onConflict: 'id', ignoreDuplicates: true });
      }
      console.log(`[load-model-list] Seeded ${rows.length} models`);
    }

    // Load all models joined with cache (for resolved sizes/names)
    const { data: models, error } = await db
      .from('model_list')
      .select(`
        id, url, folder, source,
        name, size,
        model_cache!model_list_url_fkey (name, size)
      `)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Merge: prefer cache values over base row values
    const result = (models || []).map(m => {
      const cache = m.model_cache?.[0] || {};
      return {
        id: m.id,
        url: m.url,
        name: cache.name || m.name || '',
        folder: m.folder || 'checkpoints',
        size: cache.size || m.size || '',
        source: m.source || 'file',
      };
    });

    return res.status(200).json({ models: result, count: result.length });
  } catch (err) {
    console.error('[load-model-list] Error:', err.message);
    // Graceful fallback: serve from bundled file if DB fails
    if (existsSync(MASTER_LIST)) {
      const lines = readFileSync(MASTER_LIST, 'utf-8').split('\n');
      const models = lines.map(parseLine).filter(Boolean).map(m => ({
        id: modelId(m.url),
        url: m.url,
        name: m.name || '',
        folder: m.folder,
        size: '',
        source: 'file',
      }));
      return res.status(200).json({ models, count: models.length, fallback: true });
    }
    return res.status(500).json({ error: err.message });
  }
}
