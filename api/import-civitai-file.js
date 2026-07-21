/**
 * api/import-civitai-file.js — Vercel Serverless Function
 * Reads data/civitai_download.txt from the repo, parses it, and returns models.
 * On cloud, civitai_download.txt is bundled in the repo at deploy time.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CIVITAI_TXT = join(__dirname, '..', 'data', 'civitai_download.txt');

function extractToken(url) {
  const match = url.match(/[?&]token=([a-zA-Z0-9_-]+)/);
  if (match) {
    const token = match[1];
    const clean = url.replace(/[?&]token=[a-zA-Z0-9_-]+/, '').replace(/\?&/, '?').replace(/[?&]$/, '');
    return { clean, token };
  }
  return { clean: url, token: '' };
}

function fileId(url) {
  try { return Buffer.from(url).toString('base64').slice(0, 32); } catch { return url.slice(-32); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!existsSync(CIVITAI_TXT)) {
    return res.status(404).json({ error: 'civitai_download.txt not found in data/' });
  }

  const civitaiToken = process.env.VITE_CIVITAI_TOKEN || process.env.CIVITAI_TOKEN || '';
  const lines = readFileSync(CIVITAI_TXT, 'utf-8').split('\n');
  const models = [];
  let discoveredToken = '';
  const seen = new Set();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    let rawUrl = parts[0];
    if (!rawUrl.startsWith('http')) continue;

    rawUrl = rawUrl.replace('civitai.red', 'civitai.com');
    const { clean: cleanedUrl, token: embeddedToken } = extractToken(rawUrl);

    if (embeddedToken && !discoveredToken) discoveredToken = embeddedToken;

    if (seen.has(cleanedUrl)) continue;
    seen.add(cleanedUrl);

    // Determine folder and filename
    const pathPart = parts[1] || 'checkpoints';
    const lastSlash = pathPart.lastIndexOf('/');
    let folder, name;
    if (lastSlash !== -1) {
      const afterSlash = pathPart.slice(lastSlash + 1);
      if (afterSlash.includes('.')) {
        folder = pathPart.slice(0, lastSlash);
        name = afterSlash;
      } else {
        folder = pathPart;
        name = parts[2] || '';
      }
    } else {
      folder = pathPart;
      name = parts[2] || '';
    }

    folder = folder.replace(/^models\//i, '');

    // Apply token to URL
    const token = embeddedToken || civitaiToken;
    let finalUrl = cleanedUrl;
    if (token && !finalUrl.includes('token=')) {
      finalUrl += (finalUrl.includes('?') ? '&' : '?') + `token=${token}`;
    }

    models.push({
      id: fileId(cleanedUrl),
      url: finalUrl,
      name,
      folder,
      size: '',
      source: 'civitai',
    });
  }

  return res.status(200).json({
    models,
    count: models.length,
    discoveredToken,
    tokenSaved: false,
  });
}
