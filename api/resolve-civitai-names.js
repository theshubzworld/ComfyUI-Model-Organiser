/**
 * api/resolve-civitai-names.js — Vercel Serverless Function
 * Resolves filenames for CivitAI, HuggingFace, and direct links.
 * Caches resolved names in Supabase.
 */
import { getDb, upsertCache } from './_db.js';

function getCivitaiToken() { return process.env.CIVITAI_TOKEN || process.env.VITE_CIVITAI_TOKEN || ''; }

function extractPathFilename(url) {
  try {
    const u = new URL(url);
    const fname = u.pathname.split('/').pop();
    if (fname && /\.(safetensors|ckpt|pt|bin|onnx|pth|gguf)$/i.test(fname)) {
      return decodeURIComponent(fname);
    }
  } catch (_) {}
  return '';
}

async function resolveCivitaiVersion(versionId, token) {
  let apiUrl = `https://civitai.com/api/v1/model-versions/${versionId}`;
  if (token) apiUrl += `?token=${token}`;
  const headers = { 'User-Agent': 'SimplePod-ModelCalculator/1.0' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const r = await fetch(apiUrl, { headers, signal: AbortSignal.timeout(8000) });
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
    const force = Boolean(body?.force);

    const civitaiToken = getCivitaiToken();
    const db = getDb();
    const resolved = {};

    // Count name frequencies to detect duplicate names
    const nameCounts = {};
    rawModels.forEach(m => {
      if (m?.name) nameCounts[m.name] = (nameCounts[m.name] || 0) + 1;
    });

    for (const m of rawModels) {
      if (!m || !m.url) continue;
      const url = m.url.trim();
      const name = m.name || '';
      const isDuplicate = nameCounts[name] > 1;
      const isGeneric = !name || /^\d+$/.test(name) || name.startsWith('civitai_');

      if (!force && !isGeneric && !isDuplicate) continue;

      let realName = '';

      // Check CivitAI API version ID
      const match = url.match(/\/models\/(\d+)/);
      if (match) {
        realName = await resolveCivitaiVersion(match[1], civitaiToken);
      }

      // Check direct URL path filename
      if (!realName) {
        realName = extractPathFilename(url);
      }

      if (realName && realName !== name) {
        resolved[m.id] = realName;
        await upsertCache(db, url, { name: realName }).catch(() => {});
        console.log(`[resolve-names] ${url.slice(0, 45)} -> ${realName}`);
      }
    }

    return res.status(200).json({ resolved, count: Object.keys(resolved).length });
  } catch (err) {
    console.error('[resolve-civitai-names] Error:', err.message);
    return res.status(200).json({ resolved: {}, count: 0, error: err.message });
  }
}
