/**
 * api/load-model-list.js — Vercel Serverless Function
 * Loads all models from Supabase model_list & model_cache tables.
 * On first run (empty table), seeds from bundled data/master-model-list.txt.
 */
import { getDb, cleanName } from './_db.js';
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

import { createHash } from 'crypto';

function modelId(url) {
  try { return createHash('md5').update(url.trim()).digest('hex'); } catch { return url.slice(-32); }
}

function cleanUrl(url) {
  if (!url) return url;
  return url
    .replace('civitai.red', 'civitai.com')
    .replace(/[?&]token=[a-zA-Z0-9_-]+/g, '')
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = getDb();

    if (!db) {
      // Return bundled file if DB not configured
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
      return res.status(200).json({ models: [], count: 0 });
    }

    // 1. Check count of model_list
    const { count, error: countErr } = await db
      .from('model_list')
      .select('*', { count: 'exact', head: true });

    if (!countErr && (count ?? 0) === 0 && existsSync(MASTER_LIST)) {
      // Seed from bundled file
      console.log('[load-model-list] Seeding from master-model-list.txt...');
      const lines = readFileSync(MASTER_LIST, 'utf-8').split('\n');
      const rows = lines.map(parseLine).filter(Boolean).map(m => ({
        id: modelId(m.url),
        url: m.url,
        name: m.name || null,
        folder: m.folder,
        size: null,
        source: 'file',
      }));
      for (let i = 0; i < rows.length; i += 200) {
        await db.from('model_list').upsert(rows.slice(i, i + 200), { onConflict: 'id', ignoreDuplicates: true }).catch(() => {});
      }
    }

    // 2. Fetch models from model_list
    const { data: dbModels } = await db
      .from('model_list')
      .select('id, url, folder, source, name, size')
      .order('created_at', { ascending: true });

    // 3. Fetch cache entries
    const { data: cacheRows } = await db
      .from('model_cache')
      .select('clean_url, name, size, folder');

    const cacheMap = {};
    (cacheRows || []).forEach(c => {
      if (c.clean_url) cacheMap[c.clean_url] = c;
    });

    const sourceList = (dbModels && dbModels.length > 0) ? dbModels : (existsSync(MASTER_LIST) ? readFileSync(MASTER_LIST, 'utf-8').split('\n').map(parseLine).filter(Boolean).map(m => ({ id: modelId(m.url), ...m })) : []);

    const result = sourceList.map(m => {
      const cKey = cleanUrl(m.url);
      const cached = cacheMap[cKey] || {};
      return {
        id: m.id || modelId(m.url),
        url: m.url,
        name: cleanName(cached.name || m.name || '', m.url),
        folder: cached.folder || m.folder || 'checkpoints',
        size: cached.size || m.size || '',
        source: m.source || 'file',
      };
    });

    return res.status(200).json({ models: result, count: result.length });
  } catch (err) {
    console.error('[load-model-list] Error:', err.message);
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
    return res.status(200).json({ models: [], count: 0, error: err.message });
  }
}
