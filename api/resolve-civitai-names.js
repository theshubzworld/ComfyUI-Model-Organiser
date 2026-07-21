/**
 * api/resolve-civitai-names.js — Vercel Serverless Function
 * Resolves numeric CivitAI version IDs to real filenames. Caches in Supabase.
 */
import { getDb, upsertCache } from './_db.js';

function getCivitaiToken() { return process.env.VITE_CIVITAI_TOKEN || process.env.CIVITAI_TOKEN || ''; }

async function resolveModelName(versionId, token) {
  let apiUrl = `https://civitai.com/api/v1/model-versions/${versionId}`;
  if (token) apiUrl += `?token=${token}`;
  const headers = { 'User-Agent': 'SimplePod-ModelCalculator/1.0' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const r = await fetch(apiUrl, { headers, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return '';
    const data = await r.json();
    const files = data.files || [];
    const primary = files.find(f => f.primary) || files[0];
    return primary?.name || '';
  } catch { return ''; }
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

    const civitaiToken = getCivitaiToken();
    const db = getDb();
    const resolved = {};

    for (const m of rawModels) {
      if (!m) continue;
      const url = m.url || '';
      if (!url.includes('civitai.com') && !url.includes('civitai.red')) continue;
      const name = m.name || '';
      const needsResolve = !name || /^\d+$/.test(name) || name.startsWith('civitai_');
      if (!needsResolve) continue;
      const match = url.match(/\/models\/(\d+)/);
      if (!match) continue;
      const realName = await resolveModelName(match[1], civitaiToken);
      if (realName) {
        resolved[m.id] = realName;
        await upsertCache(db, url, { name: realName }).catch(() => {});
        console.log(`[civitai-resolve] ${match[1]} -> ${realName}`);
      }
    }

    return res.status(200).json({ resolved, count: Object.keys(resolved).length });
  } catch (err) {
    console.error('[resolve-civitai-names] Error:', err.message);
    return res.status(200).json({ resolved: {}, count: 0, error: err.message });
  }
}
