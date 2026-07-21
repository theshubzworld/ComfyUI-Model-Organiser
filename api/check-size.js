/**
 * api/check-size.js — Vercel Serverless Function
 * Server-side file size checker. Tries HEAD → Range → CivitAI API → HF API.
 * Saves results to Supabase model_cache.
 */
import { getDb, upsertCache } from './_db.js';

function getCivitaiToken() { return process.env.VITE_CIVITAI_TOKEN || process.env.CIVITAI_TOKEN || ''; }
function getHfToken() { return process.env.VITE_HF_TOKEN || process.env.HF_TOKEN || ''; }

function bytesToHuman(bytes) {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }
    const { url, hfToken: clientHf, civitaiToken: clientCivitai } = body || {};
    if (!url) return res.status(400).json({ error: 'url is required' });

    const hfToken = clientHf || getHfToken();
    const civitaiToken = clientCivitai || getCivitaiToken();

    let fetchUrl = url;
    if (civitaiToken && (url.includes('civitai.com') || url.includes('civitai.red')) && !url.includes('token=')) {
      fetchUrl += (url.includes('?') ? '&' : '?') + `token=${civitaiToken}`;
    }

    const baseHeaders = { 'User-Agent': 'SimplePod-ModelCalculator/1.0' };
    if (hfToken && fetchUrl.includes('huggingface.co')) baseHeaders['Authorization'] = `Bearer ${hfToken}`;
    if (civitaiToken && (fetchUrl.includes('civitai.com') || fetchUrl.includes('civitai.red'))) {
      baseHeaders['Authorization'] = `Bearer ${civitaiToken}`;
    }

    let sizeStr = 'Unknown';

    // Method A: HEAD
    if (sizeStr === 'Unknown') {
      try {
        const r = await fetch(fetchUrl, { method: 'HEAD', headers: baseHeaders, redirect: 'follow', signal: AbortSignal.timeout(8000) });
        const cl = r.headers.get('content-length');
        if (cl) sizeStr = bytesToHuman(parseInt(cl, 10));
      } catch (_) {}
    }

    // Method B: Range request
    if (sizeStr === 'Unknown') {
      try {
        const r = await fetch(fetchUrl, { method: 'GET', headers: { ...baseHeaders, Range: 'bytes=0-10' }, redirect: 'follow', signal: AbortSignal.timeout(8000) });
        const cr = r.headers.get('content-range');
        if (cr && cr.includes('/')) {
          const total = parseInt(cr.split('/').pop(), 10);
          if (total > 0) sizeStr = bytesToHuman(total);
        }
      } catch (_) {}
    }

    // Method C: CivitAI Model Version API
    if (sizeStr === 'Unknown' && (url.includes('civitai.com') || url.includes('civitai.red'))) {
      try {
        const match = url.match(/\/models\/(\d+)/);
        if (match) {
          let apiUrl = `https://civitai.com/api/v1/model-versions/${match[1]}`;
          if (civitaiToken) apiUrl += `?token=${civitaiToken}`;
          const r = await fetch(apiUrl, { headers: baseHeaders, signal: AbortSignal.timeout(8000) });
          if (r.ok) {
            const data = await r.json();
            const primary = (data.files || []).find(f => f.primary) || data.files?.[0];
            if (primary?.sizeKB) {
              const mb = primary.sizeKB / 1024;
              sizeStr = mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
            }
          }
        }
      } catch (_) {}
    }

    // Method D: HuggingFace API
    if (sizeStr === 'Unknown' && url.includes('huggingface.co')) {
      try {
        const parts = url.split('?')[0].split('/');
        for (const marker of ['resolve', 'blob', 'raw']) {
          const idx = parts.indexOf(marker);
          if (idx > 3) {
            const repoId = parts.slice(3, idx).join('/');
            const fname = parts.slice(idx + 2).join('/');
            const hfH = { 'User-Agent': 'SimplePod-ModelCalculator/1.0' };
            if (hfToken) hfH['Authorization'] = `Bearer ${hfToken}`;
            const r = await fetch(`https://huggingface.co/api/models/${repoId}`, { headers: hfH, signal: AbortSignal.timeout(8000) });
            if (r.ok) {
              const data = await r.json();
              const sib = (data.siblings || []).find(s => s.rfilename === fname);
              if (sib?.size) {
                const mb = sib.size / (1024 * 1024);
                sizeStr = mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
              }
            }
            break;
          }
        }
      } catch (_) {}
    }

    // Cache to Supabase if we found a size
    if (sizeStr !== 'Unknown') {
      try {
        await upsertCache(getDb(), url, { size: sizeStr });
      } catch (e) {
        console.warn('[check-size] Cache write failed:', e.message);
      }
    }

    return res.status(200).json({ url, size: sizeStr });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
