/**
 * api/tokens.js — Vercel Serverless Function
 * Checks server-side API token status (HF & CivitAI).
 * Does NOT expose raw secret tokens to the client.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const hf = process.env.HF_TOKEN || process.env.VITE_HF_TOKEN || '';
  const civitai = process.env.CIVITAI_TOKEN || process.env.VITE_CIVITAI_TOKEN || '';

  if (req.method === 'POST') {
    return res.status(200).json({
      status: 'saved',
      note: 'Tokens are saved in browser localStorage for this session.',
    });
  }

  return res.status(200).json({
    hfConfigured: Boolean(hf),
    civitaiConfigured: Boolean(civitai),
  });
}
