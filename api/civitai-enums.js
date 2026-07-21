/**
 * api/civitai-enums.js — Vercel Serverless Function
 * Proxies CivitAI enums endpoint (model types, base models, etc.)
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const r = await fetch('https://civitai.com/api/v1/enums', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return res.status(r.status).json({ error: 'Failed to fetch CivitAI enums' });
    return res.status(200).json(await r.json());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
