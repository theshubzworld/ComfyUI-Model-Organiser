/**
 * api/get-tokens.js — Vercel Serverless Function
 * Returns configured API tokens (just whether they are set, not the values).
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const hf = process.env.VITE_HF_TOKEN || process.env.HF_TOKEN || '';
  const civitai = process.env.VITE_CIVITAI_TOKEN || process.env.CIVITAI_TOKEN || '';

  return res.status(200).json({
    hfToken: hf,
    civitaiToken: civitai,
    hfConfigured: Boolean(hf),
    civitaiConfigured: Boolean(civitai),
  });
}
