/**
 * api/save-models.js — Vercel Serverless Function
 * Saves/updates the full model list in Supabase model_list table.
 */
import { getDb, upsertCache } from './db.js';

function modelId(url) {
  try { return Buffer.from(url).toString('base64').slice(0, 32); } catch { return url.slice(-32); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { models = [] } = req.body || {};
    const db = getDb();

    const rows = models
      .filter(m => m.url)
      .map(m => ({
        id: m.id || modelId(m.url),
        url: m.url,
        name: m.name || null,
        folder: (m.folder || 'checkpoints').replace(/^models\//i, ''),
        size: m.size || null,
        source: 'ui',
      }));

    // Upsert in batches of 200
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await db
        .from('model_list')
        .upsert(rows.slice(i, i + 200), { onConflict: 'id' });
      if (error) throw error;
    }

    // Also cache size/name in model_cache
    for (const m of models) {
      if (m.url) {
        await upsertCache(db, m.url, { size: m.size, name: m.name, folder: m.folder }).catch(() => {});
      }
    }

    console.log(`[save-models] Saved ${models.length} models to Supabase`);
    return res.status(200).json({ status: 'success', count: models.length });
  } catch (err) {
    console.error('[save-models] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
