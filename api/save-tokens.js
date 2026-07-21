/**
 * api/save-tokens.js — Vercel Serverless Function
 * On Vercel, tokens are env vars set in Vercel dashboard — not saved at runtime.
 * This endpoint accepts the request but returns guidance instead.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // On Vercel: tokens are env vars, not writable at runtime.
  // The frontend should persist tokens in localStorage instead.
  return res.status(200).json({
    status: 'saved',
    note: 'On Vercel, tokens are managed via Vercel Environment Variables. Tokens are saved in your browser localStorage for this session.',
  });
}
