/**
 * api/analyze-links.js — Vercel Serverless Function
 * Audits model download links, identifies missing/search placeholders,
 * matches direct links against Supabase DB & master-model-list.txt,
 * and returns full health audit report with issue category filters.
 */
import { getDb, upsertCache, cleanUrl, cleanName } from './_db.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MASTER_LIST = join(__dirname, '..', 'data', 'master-model-list.txt');

function getCivitaiToken() { return process.env.CIVITAI_TOKEN || process.env.VITE_CIVITAI_TOKEN || ''; }
function getHfToken() { return process.env.HF_TOKEN || process.env.VITE_HF_TOKEN || ''; }

function bytesToHuman(bytes) {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
}

function parseMasterFile() {
  if (!existsSync(MASTER_LIST)) return [];
  const lines = readFileSync(MASTER_LIST, 'utf-8').split('\n');
  const items = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts.length >= 2 && parts[0].startsWith('http')) {
      const url = parts[0];
      const folder = (parts[1] || 'checkpoints').replace(/^models\//i, '');
      const name = parts[2] || '';
      items.push({ url, folder, name });
    }
  }
  return items;
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

    const rawModels = Array.isArray(body?.models) ? body.models : Array.isArray(body?.urls) ? body.urls : Array.isArray(body) ? body : [];

    if (!rawModels.length) {
      return res.status(200).json({
        healthScore: 100,
        validCount: 0,
        totalAudited: 0,
        issues: [],
      });
    }

    // Load master reference items
    const masterItems = parseMasterFile();
    const db = getDb();

    // Fetch DB models & cache entries for lookup
    let dbModels = [];
    let cacheMap = {};
    if (db) {
      const { data: mData } = await db.from('model_list').select('url, name, folder, size').catch(() => ({ data: [] }));
      if (mData) dbModels = mData;

      const { data: cData } = await db.from('model_cache').select('clean_url, name, size').catch(() => ({ data: [] }));
      if (cData) {
        cData.forEach(c => { if (c.clean_url) cacheMap[c.clean_url] = c; });
      }
    }

    // Combine master catalog reference
    const catalog = [...dbModels, ...masterItems];

    const issues = [];
    let validCount = 0;
    const totalAudited = rawModels.length;

    for (const m of rawModels) {
      const id = m.id || m.name || String(Math.random());
      const name = cleanName(m.name, m.url) || 'Unnamed Model';
      const folder = (m.folder || 'checkpoints').replace(/^models\//i, '');
      const rawUrl = (m.url || '').trim();

      // Case 1: Missing URL completely
      if (!rawUrl) {
        const cleanN = name.toLowerCase().replace(/\.(safetensors|ckpt|pt|bin|onnx|pth|gguf)$/i, '');
        const match = catalog.find(cat => {
          if (!cat.url || cat.url.includes('/search?q=')) return false;
          const catName = (cat.name || '').toLowerCase().replace(/\.(safetensors|ckpt|pt|bin|onnx|pth|gguf)$/i, '');
          return catName && (cleanN.includes(catName) || catName.includes(cleanN));
        });

        issues.push({
          id,
          name,
          folder,
          type: 'missing',
          currentUrl: '',
          suggestedUrl: match?.url || '',
          suggestedSize: match?.size || '',
          suggestedName: match?.name || '',
          confidence: match ? 'High' : 'Low',
        });
        continue;
      }

      // Case 2: Search URL placeholder (e.g. https://huggingface.co/search?q=...)
      if (rawUrl.includes('/search?q=')) {
        let searchQuery = '';
        try {
          const u = new URL(rawUrl);
          searchQuery = u.searchParams.get('q') || '';
        } catch (_) {}

        const targetTerm = (searchQuery || name).toLowerCase().replace(/\.(safetensors|ckpt|pt|bin|onnx|pth|gguf)$/i, '');
        const match = catalog.find(cat => {
          if (!cat.url || cat.url.includes('/search?q=')) return false;
          const catUrl = cat.url.toLowerCase();
          const catName = (cat.name || '').toLowerCase();
          return catUrl.includes(targetTerm) || catName.includes(targetTerm);
        });

        issues.push({
          id,
          name,
          folder,
          type: 'search',
          currentUrl: rawUrl,
          suggestedUrl: match?.url || '',
          suggestedSize: match?.size || '',
          suggestedName: match?.name || '',
          confidence: match ? 'High' : 'Medium',
        });
        continue;
      }

      // Case 3: Direct Download URL (http...)
      if (rawUrl.startsWith('http')) {
        validCount++;

        const cached = cacheMap[cleanUrl(rawUrl)];
        const effectiveSize = cached?.size || m.size || '';
        const effectiveName = cleanName(cached?.name || m.name, rawUrl) || '';

        const isNamePlaceholder = !effectiveName || /^\d+$/.test(effectiveName) || effectiveName.startsWith('civitai_') || effectiveName.startsWith('UTF');
        const isSizeUnknown = !effectiveSize || effectiveSize === 'Unknown';

        if (isNamePlaceholder || isSizeUnknown) {
          let resolvedSize = effectiveSize;
          let resolvedName = effectiveName;

          if (rawUrl.includes('huggingface.co')) {
            try {
              const pathname = new URL(rawUrl).pathname;
              const lastPart = pathname.split('/').filter(Boolean).pop();
              if (lastPart && /\.(safetensors|ckpt|pt|bin|onnx|pth|gguf)$/i.test(lastPart)) {
                resolvedName = decodeURIComponent(lastPart);
              }
            } catch (_) {}
          }

          if (isNamePlaceholder && resolvedName && resolvedName !== effectiveName) {
            await upsertCache(db, rawUrl, { size: resolvedSize, name: resolvedName }).catch(() => {});
          }

          if (isNamePlaceholder || isSizeUnknown) {
            issues.push({
              id,
              name: resolvedName || name,
              folder,
              type: isNamePlaceholder ? 'name' : 'size',
              currentUrl: rawUrl,
              suggestedUrl: rawUrl,
              suggestedSize: resolvedSize !== 'Unknown' ? resolvedSize : '',
              suggestedName: resolvedName || '',
              confidence: 'High',
            });
          }
        }
      } else {
        // Invalid protocol URL
        issues.push({
          id,
          name,
          folder,
          type: 'broken',
          currentUrl: rawUrl,
          suggestedUrl: '',
          suggestedSize: '',
          suggestedName: '',
          confidence: 'Low',
        });
      }
    }

    const healthScore = totalAudited > 0 ? Math.round((validCount / totalAudited) * 100) : 100;

    return res.status(200).json({
      healthScore,
      validCount,
      totalAudited,
      issues,
    });
  } catch (err) {
    console.error('[analyze-links] Error:', err.message);
    return res.status(200).json({
      healthScore: 0,
      validCount: 0,
      totalAudited: 0,
      issues: [],
      error: err.message,
    });
  }
}
