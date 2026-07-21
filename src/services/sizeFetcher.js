/**
 * Smart Model File Size Fetcher
 * Tries direct HEAD request -> HuggingFace API -> Local Server proxy
 * Automatically reads API tokens from localStorage for authenticated requests.
 */

const HF_TOKEN_KEY = 'simplepod_hf_token';
const CIVITAI_TOKEN_KEY = 'simplepod_civitai_token';

function getTokens() {
  // Priority: localStorage (UI-set, instant) > import.meta.env (.env at dev-server start)
  const lsHf = localStorage.getItem(HF_TOKEN_KEY) || '';
  const lsCivitai = localStorage.getItem(CIVITAI_TOKEN_KEY) || '';
  const envHf = import.meta.env.VITE_HF_TOKEN || '';
  const envCivitai = import.meta.env.VITE_CIVITAI_TOKEN || '';
  return {
    hfToken: lsHf || envHf,
    civitaiToken: lsCivitai || envCivitai,
  };
}

/**
 * Append CivitAI token to URL if it's a civitai.com link and token is configured.
 */
function applyCivitaiToken(url, civitaiToken) {
  if (!civitaiToken || !url.includes('civitai.com')) return url;
  // Don't double-add the token
  if (url.includes('token=')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${civitaiToken}`;
}

export async function fetchRemoteFileSize(url) {
  if (!url || !url.startsWith('http')) return 'Unknown';

  const { hfToken, civitaiToken } = getTokens();

  // Resolve final URL with auth tokens applied
  const resolvedUrl = applyCivitaiToken(url, civitaiToken);

  // Build auth headers
  const authHeaders = {};
  if (hfToken && resolvedUrl.includes('huggingface.co')) {
    authHeaders['Authorization'] = `Bearer ${hfToken}`;
  }
  if (civitaiToken && resolvedUrl.includes('civitai.com')) {
    authHeaders['Authorization'] = `Bearer ${civitaiToken}`;
  }

  // 1. Direct HEAD fetch
  let headSuccess = false;
  try {
    const res = await fetch(resolvedUrl, {
      method: 'HEAD',
      mode: 'no-cors',
      headers: authHeaders,
    });
    const length = res.headers.get('content-length');
    if (length) {
      headSuccess = true;
      const bytes = parseInt(length, 10);
      const mb = bytes / (1024 * 1024);
      return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
    }
  } catch (_) {
    // CORS or network error — continue to fallbacks
  }

  // 2. HuggingFace API fallback (JSON metadata, no CORS issues)
  if (resolvedUrl.includes('huggingface.co')) {
    try {
      const cleanUrl = resolvedUrl.split('?')[0];
      const parts = cleanUrl.split('/');
      let markerIdx = -1;
      for (const m of ['resolve', 'blob', 'raw']) {
        const i = parts.indexOf(m);
        if (i !== -1) { markerIdx = i; break; }
      }
      if (markerIdx > 3) {
        const repoId = parts.slice(3, markerIdx).join('/');
        const filename = parts.slice(markerIdx + 2).join('/');
        const apiHeaders = hfToken ? { Authorization: `Bearer ${hfToken}` } : {};
        const apiRes = await fetch(`https://huggingface.co/api/models/${repoId}`, { headers: apiHeaders });
        if (apiRes.ok) {
          const data = await apiRes.json();
          if (data.siblings && Array.isArray(data.siblings)) {
            const fileObj = data.siblings.find(
              s => s.rfilename === filename || s.rfilename.endsWith(filename) || filename.endsWith(s.rfilename)
            );
            if (fileObj && fileObj.size) {
              const mb = fileObj.size / (1024 * 1024);
              return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
            }
          }
        }
      }
    } catch (e) {
      console.warn('HF API size query error:', e);
    }
  }

  // 3. CivitAI API fallback — try the CivitAI models API
  if (url.includes('civitai.com') || url.includes('civitai.red')) {
    try {
      const match = url.match(/\/models\/(\d+)/);
      if (match) {
        const modelVersionId = match[1];
        let civApiUrl = `https://civitai.com/api/v1/model-versions/${modelVersionId}`;
        if (civitaiToken) {
          civApiUrl += `?token=${civitaiToken}`;
        }
        const civRes = await fetch(civApiUrl);
        if (civRes.ok) {
          const data = await civRes.json();
          const primaryFile = (data.files || []).find(f => f.primary) || data.files?.[0];
          if (primaryFile && primaryFile.sizeKB) {
            const mb = primaryFile.sizeKB / 1024;
            return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
          }
        }
      }
    } catch (e) {
      console.warn('CivitAI API size query error:', e);
    }
  }


  // 4. Backend proxy fallback — server-side HEAD + Range requests, no CORS limits
  try {
    const res = await fetch('/api/check-size', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: resolvedUrl,
        hfToken: hfToken || undefined,
        civitaiToken: civitaiToken || undefined,
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.size && data.size !== 'Unknown') return data.size;
    }
  } catch (e) {
    // Ignore if backend not running
  }

  return 'Unknown';
}

/**
 * Resolve a URL with the user's tokens applied (for export/download use).
 */
export function resolveDownloadUrl(url) {
  if (!url) return url;
  const { civitaiToken } = getTokens();
  return applyCivitaiToken(url, civitaiToken);
}
