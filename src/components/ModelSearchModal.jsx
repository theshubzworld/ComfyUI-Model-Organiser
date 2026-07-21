import React, { useState, useEffect, useRef } from 'react';
import {
  X, Search, RefreshCw, ExternalLink, Check,
  Download, Star, TrendingDown, HardDrive, AlertCircle
} from 'lucide-react';
import { loadTokens } from './TokenSettingsModal';

const PLATFORM_OPTIONS = [
  { id: 'both',    label: 'Both',          color: 'violet' },
  { id: 'hf',      label: 'HuggingFace',   color: 'amber' },
  { id: 'civitai', label: 'CivitAI',        color: 'blue' },
];

const PLATFORM_STYLES = {
  huggingface: {
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    dot: 'bg-amber-400',
    label: 'HuggingFace',
  },
  civitai: {
    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    dot: 'bg-blue-400',
    label: 'CivitAI',
  },
};

export function ModelSearchModal({ isOpen, onClose, initialQuery = '', targetModelId = null, onAttachUrl }) {
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('both');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // 'idle'|'loading'|'done'|'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [attached, setAttached] = useState(null); // result that was just attached
  const [fallbackPlatform, setFallbackPlatform] = useState(null);
  const inputRef = useRef(null);

  // Pre-fill query & auto-search when opened for a specific model
  useEffect(() => {
    if (isOpen) {
      const cleaned = (initialQuery || '').replace(/\.(safetensors|ckpt|pt|bin|onnx|pth|gguf|zip)$/i, '').trim();
      setQuery(cleaned);
      setPlatform('both');
      setResults([]);
      setFallbackPlatform(null);
      setStatus('idle');
      setErrorMsg('');
      setAttached(null);
      setTimeout(() => inputRef.current?.focus(), 100);

      // Auto-trigger search if we have a non-empty initial query
      if (cleaned) {
        setStatus('loading');
        fetch(`/api/search-models?q=${encodeURIComponent(cleaned)}&platform=both`)
          .then(r => r.ok ? r.json() : Promise.reject(r.status))
          .then(data => {
            setResults(data.results || []);
            setFallbackPlatform(data.fallbackPlatform || null);
            setStatus('done');
          })
          .catch(e => {
            setErrorMsg(e.message || 'Search failed');
            setStatus('error');
          });
      }
    }
  }, [isOpen, initialQuery]);

  if (!isOpen) return null;

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setStatus('loading');
    setResults([]);
    setErrorMsg('');
    setAttached(null);

    try {
      const url = `/api/search-models?q=${encodeURIComponent(query.trim())}&platform=${platform}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setResults(data.results || []);
      setFallbackPlatform(data.fallbackPlatform || null);
      setStatus('done');
    } catch (e) {
      setErrorMsg(e.message);
      setStatus('error');
    }
  };

  const handleAttach = (result) => {
    const { civitaiToken } = loadTokens();
    let finalUrl = result.url;
    // Append civitai token if needed
    if (result.platform === 'civitai' && civitaiToken && !finalUrl.includes('token=')) {
      finalUrl += `&token=${civitaiToken}`;
    }
    onAttachUrl(targetModelId, { url: finalUrl, size: result.size, name: result.name });
    setAttached(result.url);
  };

  const hfCount = results.filter(r => r.platform === 'huggingface').length;
  const civitaiCount = results.filter(r => r.platform === 'civitai').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-2xl glass-panel rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh] relative overflow-hidden">

        {/* Top gradient bar */}
        <div className="h-1 w-full bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-500 shrink-0" />

        <div className="p-5 flex flex-col flex-1 min-h-0">

          {/* Header */}
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-violet-500/20 border border-violet-500/30">
                <Search className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Search Models</h3>
                {targetModelId && (
                  <p className="text-[11px] text-slate-500">
                    Searching to fill missing URL · result will attach automatically
                  </p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search form */}
          <form onSubmit={handleSearch} className="space-y-3 mb-4 shrink-0">
            {/* Platform toggle */}
            <div className="flex gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-white/10">
              {PLATFORM_OPTIONS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    platform === p.id
                      ? 'bg-violet-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Query input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="e.g. flux-dev, SDXL, wan2.2, boob_slider..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-white/15 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-mono transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={status === 'loading' || !query.trim()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-bold transition-all shadow-lg shadow-violet-600/20"
              >
                {status === 'loading'
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <Search className="w-4 h-4" />
                }
                {status === 'loading' ? 'Searching…' : 'Search'}
              </button>
            </div>
          </form>

          {/* Results header & fallback banner */}
          {status === 'done' && (
            <div className="space-y-2 mb-2 shrink-0">
              {fallbackPlatform && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>No matches on {platform === 'hf' ? 'HuggingFace' : 'CivitAI'}, but found matches on {fallbackPlatform === 'civitai' ? 'CivitAI' : 'HuggingFace'} below!</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setPlatform(fallbackPlatform); setFallbackPlatform(null); }}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] transition-all"
                  >
                    Switch to {fallbackPlatform === 'civitai' ? 'CivitAI' : 'HuggingFace'}
                  </button>
                </div>
              )}
              {results.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 font-semibold">{results.length} results for "{query}"</span>
                  <div className="flex items-center gap-2">
                    {hfCount > 0 && (
                      <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        {hfCount} HuggingFace
                      </span>
                    )}
                    {civitaiCount > 0 && (
                      <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        {civitaiCount} CivitAI
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}


          {/* Results list */}
          <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-0.5">

            {status === 'idle' && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="w-10 h-10 text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">Search HuggingFace and CivitAI for any model</p>
                <p className="text-slate-600 text-xs mt-1">Results include download URLs and file sizes</p>
              </div>
            )}

            {status === 'loading' && (
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-violet-400 animate-spin mb-3" />
                <p className="text-slate-400 text-sm">Searching {platform === 'both' ? 'HuggingFace & CivitAI' : platform === 'hf' ? 'HuggingFace' : 'CivitAI'}…</p>
              </div>
            )}

            {status === 'error' && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <p className="text-sm text-rose-300 font-semibold">Search failed</p>
                  <p className="text-xs text-rose-400/80 mt-0.5">{errorMsg}</p>
                </div>
              </div>
            )}

            {status === 'done' && results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <Search className="w-8 h-8 text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">No models found for "{query}"</p>
                <p className="text-slate-600 text-xs mt-1">Try different keywords or check your API tokens</p>
              </div>
            )}

            {results.map((r, i) => {
              const ps = PLATFORM_STYLES[r.platform] || PLATFORM_STYLES.huggingface;
              const isAttached = attached === r.url;

              return (
                <div
                  key={i}
                  className={`group rounded-xl border transition-all ${
                    isAttached
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-white/8 bg-slate-900/50 hover:border-white/15 hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-start gap-3 p-3">
                    {/* Platform dot */}
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ps.dot}`} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* File name (primary) */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-white font-mono font-semibold truncate">{r.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-bold shrink-0 ${ps.badge}`}>
                          {ps.label}
                        </span>
                        {r.type && r.type !== 'unknown' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-violet-500/30 text-violet-400 bg-violet-500/10 font-semibold shrink-0">
                            {r.type}
                          </span>
                        )}
                      </div>

                      {/* Model name & author */}
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-slate-400">
                          <span className="text-slate-300 font-semibold">{r.modelName}</span>
                          {r.author && <span className="text-slate-500"> by {r.author}</span>}
                        </span>
                        {r.versionName && (
                          <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 rounded">{r.versionName}</span>
                        )}
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {/* Size */}
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <HardDrive className="w-3 h-3" />
                          <span className={r.size === 'Unknown' ? 'text-slate-600' : 'text-emerald-400 font-semibold'}>
                            {r.size}
                          </span>
                        </span>
                        {/* Downloads */}
                        {r.downloads > 0 && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-500">
                            <Download className="w-3 h-3" />
                            {r.downloads.toLocaleString()}
                          </span>
                        )}
                        {/* Rating */}
                        {r.rating > 0 && (
                          <span className="flex items-center gap-1 text-[11px] text-amber-400">
                            <Star className="w-3 h-3" />
                            {r.rating.toFixed(1)}
                          </span>
                        )}
                        {/* URL preview */}
                        <span className="text-[10px] text-slate-600 font-mono truncate max-w-[280px]">
                          {r.url.replace('https://', '')}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 self-center">
                      {/* Open in browser */}
                      <a
                        href={r.platform === 'huggingface'
                          ? `https://huggingface.co/${r.repoId}`
                          : `https://civitai.com/models/${r.versionId || ''}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                        title="View on website"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      {/* Attach / Use this URL */}
                      {targetModelId ? (
                        <button
                          onClick={() => handleAttach(r)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            isAttached
                              ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                              : 'bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-600/20'
                          }`}
                        >
                          {isAttached ? <><Check className="w-3.5 h-3.5" /> Attached</> : 'Use This'}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(r.url);
                            setAttached(r.url);
                            setTimeout(() => setAttached(null), 2000);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            isAttached
                              ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                          }`}
                        >
                          {isAttached ? <><Check className="w-3.5 h-3.5" /> Copied!</> : 'Copy URL'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer hint */}
          {!targetModelId && results.length > 0 && (
            <div className="pt-3 shrink-0 text-center">
              <p className="text-[11px] text-slate-600">
                Tip: Click a 🔍 icon on any model row to search and auto-attach its URL
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
