/**
 * api/hf-explorer.js — Vercel Serverless Function
 * Proxies HuggingFace model search with server-side auth token.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const hfToken = process.env.VITE_HF_TOKEN || process.env.HF_TOKEN || '';
  const { query = '', filter = '', sort = 'downloads', limit = 20, page = 1 } = req.query || {};

  const params = new URLSearchParams({
    limit: String(Math.min(50, Math.max(1, parseInt(limit, 10) || 20))),
    sort,
    direction: '-1',
  });
  if (query) params.set('search', query);
  if (filter) params.set('filter', filter);

  const hfUrl = `https://huggingface.co/api/models?${params.toString()}`;
  const headers = { 'User-Agent': 'SimplePod-ModelCalculator/1.0' };
  if (hfToken) headers['Authorization'] = `Bearer ${hfToken}`;

  try {
    const r = await fetch(hfUrl, { headers, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return res.status(r.status).json({ error: `HuggingFace API returned HTTP ${r.status}` });

    const hfModels = await r.json();
    const items = [];

    for (const hm of hfModels.slice(0, 20)) {
      const modelId = hm.modelId || hm.id || '';
      if (!modelId) continue;

      // Fetch per-model file list
      let files = [];
      try {
        const fr = await fetch(`https://huggingface.co/api/models/${modelId}`, { headers, signal: AbortSignal.timeout(6000) });
        if (fr.ok) {
          const fdata = await fr.json();
          files = (fdata.siblings || [])
            .filter(s => /\.(safetensors|ckpt|pt|bin|gguf|onnx|pth)$/.test(s.rfilename || ''))
            .slice(0, 3)
            .map(s => {
              const mb = (s.size || 0) / (1024 * 1024);
              return {
                name: s.rfilename,
                size: mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : mb > 0 ? `${mb.toFixed(2)} MB` : 'Unknown',
                downloadUrl: `https://huggingface.co/${modelId}/resolve/main/${s.rfilename}`,
              };
            });
        }
      } catch (_) {}

      // Determine model type from tags
      const tags = hm.tags || [];
      let mtype = 'checkpoints';
      if (tags.some(t => ['lora', 'LoRA'].includes(t))) mtype = 'loras';
      else if (tags.some(t => ['gguf', 'text-generation'].includes(t))) mtype = 'unet';

      items.push({
        id: modelId,
        name: modelId,
        type: mtype,
        author: hm.author || '',
        tags: tags.slice(0, 5),
        downloads: hm.downloads || 0,
        likes: hm.likes || 0,
        files,
        modelUrl: `https://huggingface.co/${modelId}`,
      });
    }

    return res.status(200).json({ items, count: items.length });
  } catch (err) {
    console.error('[hf-explorer] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
