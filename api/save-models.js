/**
 * api/save-models.js — Vercel Serverless Function
 * Saves/updates the full model list in Supabase model_list table.
 */
import { getDb, upsertCache } from './_db.js';

import { createHash } from 'crypto';

function modelId(url) {
  try { return createHash('md5').update(url.trim()).digest('hex'); } catch { return url.slice(-32); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }

    const rawModels = Array.isArray(body?.models) ? body.models : Array.isArray(body) ? body : [];
    const db = getDb();

    if (!db) {
      return res.status(200).json({ status: 'skipped', note: 'Supabase DB not configured on server', count: rawModels.length });
    }

    const rows = rawModels
      .filter(m => m && m.url)
      .map(m => ({
        id: m.id || modelId(m.url),
        url: m.url,
        name: m.name || null,
        folder: (m.folder || 'checkpoints').replace(/^models\//i, ''),
        size: m.size || null,
        source: 'ui',
      }));

    if (rows.length > 0) {
      // Upsert in batches of 200
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await db
          .from('model_list')
          .upsert(rows.slice(i, i + 200), { onConflict: 'id' });
        if (error) console.warn('[save-models] Upsert warning:', error.message);
      }
    }

    // Also cache size/name in model_cache
    for (const m of rawModels) {
      if (m && m.url) {
        await upsertCache(db, m.url, { size: m.size, name: m.name, folder: m.folder }).catch(() => {});
      }
    }

    console.log(`[save-models] Saved ${rawModels.length} models to Supabase`);
    return res.status(200).json({ status: 'success', count: rawModels.length });
  } catch (err) {
    console.error('[save-models] Error:', err.message);
    return res.status(200).json({ status: 'error', error: err.message });
  }
}
