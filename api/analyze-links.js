/**
 * api/analyze-links.js — Vercel Serverless Function
 * Analyzes a batch of URLs for size/filename. Caches results in Supabase.
 */
import { getDb, upsertCache } from './db.js';

function getCivitaiToken() { return process.env.VITE_CIVITAI_TOKEN || process.env.CIVITAI_TOKEN || ''; }
function getHfToken() { return process.env.VITE_HF_TOKEN || process.env.HF_TOKEN || ''; }

function bytesToHuman(bytes) {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
}

async function analyzeUrl(rawUrl) {
  const hfToken = getHfToken();
  const civitaiToken = getCivitaiToken();
  let url = rawUrl.trim();
  if (!url.startsWith('http')) return { url, name: '', size: 'Unknown', error: 'Invalid URL' };

  if (civitaiToken && (url.includes('civitai.com') || url.includes('civitai.red')) && !url.includes('token=')) {
    url += (url.includes('?') ? '&' : '?') + `token=${civitaiToken}`;
  }

  const headers = { 'User-Agent': 'SimplePod-ModelCalculator/1.0' };
  if (hfToken && url.includes('huggingface.co')) headers['Authorization'] = `Bearer ${hfToken}`;
  if (civitaiToken && (url.includes('civitai.com') || url.includes('civitai.red'))) headers['Authorization'] = `Bearer ${civitaiToken}`;

  let size = 'Unknown', name = '';
  const platform = url.includes('civitai.com') || url.includes('civitai.red') ? 'civitai'
    : url.includes('huggingface.co') ? 'huggingface' : 'direct';

  try {
    const r = await fetch(url, { method: 'HEAD', headers, redirect: 'follow', signal: AbortSignal.timeout(8000) });
    const cl = r.headers.get('content-length');
    if (cl) size = bytesToHuman(parseInt(cl, 10));
    const cd = r.headers.get('content-disposition');
    if (cd) { const m = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/); if (m) name = m[1].replace(/['"]/g, '').trim(); }
  } catch (_) {}

  if (size === 'Unknown' && platform === 'civitai') {
    try {
      const match = url.match(/\/models\/(\d+)/);
      if (match) {
        let apiUrl = `https://civitai.com/api/v1/model-versions/${match[1]}`;
        if (civitaiToken) apiUrl += `?token=${civitaiToken}`;
        const r = await fetch(apiUrl, { headers, signal: AbortSignal.timeout(8000) });
        if (r.ok) {
          const data = await r.json();
          const primary = (data.files || []).find(f => f.primary) || data.files?.[0];
          if (primary) {
            if (primary.sizeKB) { const mb = primary.sizeKB / 1024; size = mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`; }
            if (primary.name) name = primary.name;
          }
        }
      }
    } catch (_) {}
  }

  return { url: rawUrl, name, size, platform };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { urls = [] } = req.body || {};
    const db = getDb();
    const results = await Promise.all(urls.map(analyzeUrl));
    for (const r of results) {
      if (r.size !== 'Unknown' || r.name) {
        await upsertCache(db, r.url, { size: r.size, name: r.name }).catch(() => {});
      }
    }
    return res.status(200).json({ results, count: results.length });
  } catch (err) {
    console.error('[analyze-links] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
