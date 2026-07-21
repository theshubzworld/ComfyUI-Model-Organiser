/**
 * api/save-models.js — Vercel Serverless Function
 * Saves/updates the full model list & cache in Supabase using bulk upserts.
 */
import { getDb, cleanUrl } from './_db.js';
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

    // 1. Prepare model_list rows
    const listRows = rawModels
      .filter(m => m && m.url)
      .map(m => ({
        id: m.id || modelId(m.url),
        url: m.url,
        name: m.name || null,
        folder: (m.folder || 'checkpoints').replace(/^models\//i, ''),
        size: m.size || null,
        source: 'ui',
      }));

    // Bulk upsert model_list in batches of 100
    for (let i = 0; i < listRows.length; i += 100) {
      await db
        .from('model_list')
        .upsert(listRows.slice(i, i + 100), { onConflict: 'id' })
        .catch(err => console.warn('[save-models] list upsert error:', err.message));
    }

    // 2. Prepare model_cache rows (bulk batch instead of 300+ individual requests)
    const cacheRows = rawModels
      .filter(m => m && m.url)
      .map(m => {
        const key = cleanUrl(m.url);
        if (!key) return null;
        const row = { clean_url: key };
        if (m.size && m.size !== 'Unknown') row.size = m.size;
        if (m.name && !/^\d+$/.test(m.name) && !m.name.startsWith('civitai_')) row.name = m.name;
        if (m.folder) row.folder = m.folder;
        return Object.keys(row).length > 1 ? row : null;
      })
      .filter(Boolean);

    // Bulk upsert model_cache in batches of 100
    for (let i = 0; i < cacheRows.length; i += 100) {
      await db
        .from('model_cache')
        .upsert(cacheRows.slice(i, i + 100), { onConflict: 'clean_url' })
        .catch(err => console.warn('[save-models] cache upsert error:', err.message));
    }

    console.log(`[save-models] Saved ${rawModels.length} models to Supabase in bulk`);
    return res.status(200).json({ status: 'success', count: rawModels.length });
  } catch (err) {
    console.error('[save-models] Error:', err.message);
    return res.status(200).json({ status: 'error', error: err.message });
  }
}
