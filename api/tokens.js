/**
 * api/tokens.js — Vercel Serverless Function
 * Handles GET (check token status) and POST (save tokens stub).
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const hf = process.env.VITE_HF_TOKEN || process.env.HF_TOKEN || '';
  const civitai = process.env.VITE_CIVITAI_TOKEN || process.env.CIVITAI_TOKEN || '';

  if (req.method === 'POST') {
    return res.status(200).json({
      status: 'saved',
      note: 'On Vercel, tokens are managed via Vercel Environment Variables. Tokens are saved in your browser localStorage for this session.',
    });
  }

  return res.status(200).json({
    hfToken: hf,
    civitaiToken: civitai,
    hfConfigured: Boolean(hf),
    civitaiConfigured: Boolean(civitai),
  });
}
