/**
 * api/search-models.js — Vercel Serverless Function
 * Searches HuggingFace and/or CivitAI with fallback logic. 
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const hfToken = process.env.VITE_HF_TOKEN || process.env.HF_TOKEN || '';
  const civitaiToken = process.env.VITE_CIVITAI_TOKEN || process.env.CIVITAI_TOKEN || '';

  const rawQuery = (req.query?.q || '').trim();
  const platform = req.query?.platform || 'both';

  if (!rawQuery) return res.status(400).json({ error: 'Missing ?q= query parameter' });

  const hfHeaders = { 'User-Agent': 'SimplePod-ModelCalculator/1.0' };
  if (hfToken) hfHeaders['Authorization'] = `Bearer ${hfToken}`;

  const civitaiHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };
  if (civitaiToken) civitaiHeaders['Authorization'] = `Bearer ${civitaiToken}`;

  // Tokenize query
  const words = rawQuery.split(/[-_\s.]+/).filter(w => w);
  const stopTags = new Set(['t2v', 'i2v', 'low', 'high', 'safetensors', 'ckpt', 'v1', 'v2', 'lora', 'xl', 'sdxl', 'fp16', 'fp8']);
  const significant = words.filter(w => w.length > 2 && !stopTags.has(w.toLowerCase()));
  const terms = [rawQuery, words.join(' '), ...significant.slice(0, 2)].filter((t, i, a) => a.indexOf(t) === i);

  const results = [];
  const seen = new Set();

  async function fetchHF(q) {
    try {
      const url = `https://huggingface.co/api/models?search=${encodeURIComponent(q)}&limit=6&sort=downloads&direction=-1`;
      const r = await fetch(url, { headers: hfHeaders, signal: AbortSignal.timeout(8000) });
      if (!r.ok) return [];
      const models = await r.json();
      const out = [];
      for (const hm of models.slice(0, 6)) {
        const modelId = hm.modelId || hm.id || '';
        if (!modelId) continue;
        // Get files
        const fr = await fetch(`https://huggingface.co/api/models/${modelId}`, { headers: hfHeaders, signal: AbortSignal.timeout(6000) }).catch(() => null);
        if (!fr?.ok) continue;
        const fdata = await fr.json();
        const modelFiles = (fdata.siblings || []).filter(s => /\.(safetensors|ckpt|pt|bin|gguf|onnx|pth)$/.test(s.rfilename || ''));
        for (const mf of modelFiles.slice(0, 2)) {
          const mb = (mf.size || 0) / (1024 * 1024);
          const sizeStr = mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : mb > 0 ? `${mb.toFixed(2)} MB` : 'Unknown';
          const dlUrl = `https://huggingface.co/${modelId}/resolve/main/${mf.rfilename}`;
          if (!seen.has(dlUrl)) {
            seen.add(dlUrl);
            const tags = hm.tags || [];
            let mtype = 'checkpoints';
            if (tags.some(t => ['lora', 'LoRA'].includes(t))) mtype = 'loras';
            else if (tags.some(t => ['gguf', 'text-generation'].includes(t))) mtype = 'unet';
            out.push({ name: mf.rfilename, url: dlUrl, size: sizeStr, folder: mtype, platform: 'huggingface', repo: modelId });
          }
        }
      }
      return out;
    } catch { return []; }
  }

  async function fetchCivitAI(q) {
    try {
      let apiUrl = `https://civitai.com/api/v1/models?query=${encodeURIComponent(q)}&limit=6&sort=Most%20Downloaded&period=AllTime`;
      if (civitaiToken) apiUrl += `&token=${civitaiToken}`;
      const r = await fetch(apiUrl, { headers: civitaiHeaders, signal: AbortSignal.timeout(8000) });
      if (!r.ok) return [];
      const data = await r.json();
      const out = [];
      for (const item of (data.items || []).slice(0, 6)) {
        for (const ver of (item.modelVersions || []).slice(0, 1)) {
          for (const f of (ver.files || []).slice(0, 2)) {
            const dlUrl = `https://civitai.com/api/download/models/${ver.id}?type=Model&format=SafeTensor`;
            if (!seen.has(dlUrl)) {
              seen.add(dlUrl);
              const kb = f.sizeKB || 0; const mb = kb / 1024;
              const sizeStr = mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : mb > 0 ? `${mb.toFixed(2)} MB` : 'Unknown';
              const typeMap = { Checkpoint: 'checkpoints', LORA: 'loras', TextualInversion: 'embeddings', VAE: 'vae', Controlnet: 'controlnet', Upscaler: 'upscale_models' };
              out.push({ name: f.name || `civitai_${ver.id}.safetensors`, url: dlUrl, size: sizeStr, folder: typeMap[item.type] || 'checkpoints', platform: 'civitai', modelName: item.name });
            }
          }
        }
      }
      return out;
    } catch { return []; }
  }

  for (const term of terms) {
    if (results.length >= 12) break;
    if (platform === 'hf' || platform === 'both') {
      const hfRes = await fetchHF(term);
      results.push(...hfRes.slice(0, 6 - results.filter(r => r.platform === 'huggingface').length));
    }
    if (platform === 'civitai' || platform === 'both') {
      const civRes = await fetchCivitAI(term);
      results.push(...civRes.slice(0, 6 - results.filter(r => r.platform === 'civitai').length));
    }
  }

  return res.status(200).json({ query: rawQuery, results, count: results.length });
}
