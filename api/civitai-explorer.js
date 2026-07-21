/**
 * api/civitai-explorer.js — Vercel Serverless Function
 * Proxies CivitAI /api/v1/models with filters, appending auth token server-side.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Handle enums endpoint check
  if (req.query?.enums === 'true' || req.query?.enums === '') {
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

  const civitaiToken = process.env.VITE_CIVITAI_TOKEN || process.env.CIVITAI_TOKEN || '';

  // Forward all query params
  const params = new URLSearchParams(req.query || {});
  if (civitaiToken && !params.has('token')) params.set('token', civitaiToken);

  const url = `https://civitai.com/api/v1/models?${params.toString()}`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };
  if (civitaiToken) headers['Authorization'] = `Bearer ${civitaiToken}`;

  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return res.status(r.status).json({ error: `CivitAI API returned HTTP ${r.status}` });

    const raw = await r.json();
    const items = (raw.items || []).map(item => {
      const versions = (item.modelVersions || []).map(ver => {
        const v_dl = `https://civitai.com/api/download/models/${ver.id}?type=Model&format=SafeTensor`;
        const v_files = (ver.files || []).map(f => {
          const kb = f.sizeKB || 0;
          const mb = kb / 1024;
          return {
            id: f.id,
            name: f.name || `civitai_${ver.id}.safetensors`,
            size: mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : mb > 0 ? `${mb.toFixed(2)} MB` : 'Unknown',
            sizeKB: kb,
            primary: f.primary || false,
            downloadUrl: v_dl,
          };
        });
        const v_images = (ver.images || []).slice(0, 4).map(img => ({
          url: img.url?.replace('/original=true/', '/width=450/').replace('/width=1024/', '/width=450/') || img.url,
          nsfw: img.nsfwLevel || 'None',
        }));
        return {
          id: ver.id,
          name: ver.name || '',
          baseModel: ver.baseModel || '',
          downloadUrl: v_dl,
          files: v_files,
          images: v_images,
        };
      });

      const stats = item.stats || {};
      const creator = item.creator || {};
      return {
        id: item.id,
        name: item.name || '',
        type: item.type || 'Other',
        nsfw: item.nsfw || false,
        tags: (item.tags || []).slice(0, 5),
        creator: { username: creator.username || 'Anonymous', image: creator.image || '' },
        stats: {
          downloadCount: stats.downloadCount || 0,
          thumbsUpCount: stats.thumbsUpCount || 0,
          rating: stats.rating || 0,
          ratingCount: stats.ratingCount || 0,
        },
        modelVersions: versions,
      };
    });

    const meta = raw.metadata || {};
    return res.status(200).json({
      items,
      count: items.length,
      totalPages: meta.totalPages || 1,
      totalItems: meta.totalItems || items.length,
    });
  } catch (err) {
    console.error('[civitai-explorer] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
