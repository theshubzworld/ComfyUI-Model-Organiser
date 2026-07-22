import React, { useState } from 'react';
import { X, Plus, Link, Folder, FileText, Layers, Check, Download, RefreshCw, ShoppingBag, AlertCircle } from 'lucide-react';
import { parseTextDownloadList } from '../services/workflowParser';
import { COMFYUI_MODEL_FOLDERS, normalizeModelFolder } from '../data/comfyuiFolders';
import { fetchRemoteFileSize } from '../services/sizeFetcher';

export function AddModelModal({ isOpen, onClose, onAddModel, onBulkAddModels, onUpdateModel, existingModels = [], catalog }) {
  const [tab, setTab] = useState('single'); // 'single' | 'bulk' | 'civitai'
  
  // Single Model Form State
  const [url, setUrl] = useState('');
  const [folder, setFolder] = useState('checkpoints');
  const [name, setName] = useState('');
  const [size, setSize] = useState('');

  // Bulk Form State
  const [bulkText, setBulkText] = useState('');
  const [isResolvingBulk, setIsResolvingBulk] = useState(false);

  // CivitAI import state
  const [civitaiStatus, setCivitaiStatus] = useState('idle'); // 'idle'|'loading'|'done'|'error'
  const [civitaiModels, setCivitaiModels] = useState([]);     // new models to add
  const [civitaiUrlUpdates, setCivitaiUrlUpdates] = useState([]); // {id, url} patches for existing
  const [civitaiSkipped, setCivitaiSkipped] = useState(0);   // true duplicate count
  const [civitaiMsg, setCivitaiMsg] = useState('');

  if (!isOpen) return null;

  const handleSingleSubmit = (e) => {
    e.preventDefault();
    if (!url && !name) {
      alert('Please enter at least a model name or download URL.');
      return;
    }

    const filename = name.trim() || url.split('/').pop() || 'model.safetensors';
    
    onAddModel({
      id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: filename,
      folder: normalizeModelFolder(folder),
      url: url.trim(),
      size: size.trim() || 'Unknown',
      source: 'user_added'
    });

    // Reset
    setUrl('');
    setName('');
    setSize('');
    setFolder('checkpoints'); // BUG-10 fix: reset folder to default
    onClose();
  };

  const resolveBulkModels = async (models) => {
    const civitaiToken = localStorage.getItem('simplepod_civitai_token') || '';
    
    const resolvedList = await Promise.all(
      models.map(async (m) => {
        let updated = { ...m };

        const isGenericName = !updated.name || 
          /^\d+$/.test(updated.name) || 
          updated.name.startsWith('civitai_') || 
          updated.name === 'civitai_model.safetensors' || 
          updated.name === 'model.safetensors';

        // 1. Resolve name from CivitAI API for generic entries
        if (isGenericName && updated.url && (updated.url.includes('civitai.com') || updated.url.includes('civitai.red'))) {
          const vMatch = updated.url.match(/\/models\/(\d+)/);
          if (vMatch) {
            const versionId = vMatch[1];
            try {
              let apiUrl = `https://civitai.com/api/v1/model-versions/${versionId}`;
              if (civitaiToken && !updated.url.includes('token=')) {
                apiUrl += `?token=${civitaiToken}`;
              }
              const res = await fetch(apiUrl, { signal: AbortSignal.timeout(6000) });
              if (res.ok) {
                const data = await res.json();
                const primary = (data.files || []).find(f => f.primary) || data.files?.[0];
                if (primary?.name) {
                  updated.name = primary.name;
                }
                if (primary?.sizeKB && (!updated.size || updated.size === 'Unknown')) {
                  const mb = primary.sizeKB / 1024;
                  updated.size = mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
                }
              }
            } catch (_) {}
          }
        }

        // 2. Fetch size if still unknown
        if ((!updated.size || updated.size === 'Unknown') && updated.url) {
          try {
            const sizeRes = await fetchRemoteFileSize(updated.url);
            if (typeof sizeRes === 'object' && sizeRes.size) {
              if (sizeRes.size !== 'Unknown') updated.size = sizeRes.size;
              if (sizeRes.name && (!updated.name || updated.name.startsWith('civitai_'))) {
                updated.name = sizeRes.name;
              }
            } else if (typeof sizeRes === 'string' && sizeRes !== 'Unknown') {
              updated.size = sizeRes;
            }
          } catch (_) {}
        }

        return updated;
      })
    );

    return resolvedList;
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (!bulkText.trim() || isResolvingBulk) return;

    const parsedModels = parseTextDownloadList(bulkText, catalog);
    if (parsedModels.length === 0) return;

    setIsResolvingBulk(true);
    try {
      const resolvedModels = await resolveBulkModels(parsedModels);
      onBulkAddModels(resolvedModels);
      setBulkText('');
      onClose();
    } catch (err) {
      console.error('Bulk resolve error:', err);
      onBulkAddModels(parsedModels);
      setBulkText('');
      onClose();
    } finally {
      setIsResolvingBulk(false);
    }
  };

  const handleCivitaiImport = async () => {
    setCivitaiStatus('loading');
    setCivitaiMsg('Fetching & resolving model names from CivitAI API...');
    try {
      const res = await fetch('/api/import-civitai-file');
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Server error');
      }
      const data = await res.json();
      const fetched = data.models || [];

      // ── Dedup against existing models ──────────────────────────────────────
      // Helper: normalize filename for comparison (lowercase, strip extension)
      const normName = (n = '') =>
        n.toLowerCase().trim().replace(/\.(safetensors|ckpt|pt|bin|onnx|pth|gguf|zip)$/i, '');

      // Build lookup sets from existing models
      const existingVersionIds = new Set(
        existingModels
          .map(m => { const match = (m.url || '').match(/\/models\/(\d+)/); return match?.[1]; })
          .filter(Boolean)
      );
      const existingNormNames = new Map(
        existingModels.map(m => [normName(m.name), m])
      );

      const newModels = [];
      const urlUpdates = [];   // existing model that needs its URL filled in
      let skippedCount = 0;

      for (const m of fetched) {
        const versionId = (m.url || '').match(/\/models\/(\d+)/)?.[1];
        const mNorm = normName(m.name);

        // 1. Exact CivitAI version ID match → definite duplicate
        if (versionId && existingVersionIds.has(versionId)) {
          skippedCount++;
          continue;
        }

        // 2. Filename match
        const existingByName = existingNormNames.get(mNorm);
        if (existingByName) {
          if (!existingByName.url && m.url) {
            // Same name but existing entry has no URL → update it instead of duplicating
            urlUpdates.push({ id: existingByName.id, url: m.url });
          } else {
            skippedCount++; // Same name & both have URLs → true duplicate
          }
          continue;
        }

        // 3. Genuinely new — add it
        newModels.push(m);
      }
      // ───────────────────────────────────────────────────────────────────────

      setCivitaiModels(newModels);
      setCivitaiUrlUpdates(urlUpdates);
      setCivitaiSkipped(skippedCount);

      const parts = [];
      if (newModels.length) parts.push(`${newModels.length} new`);
      if (urlUpdates.length) parts.push(`${urlUpdates.length} URL updates`);
      if (skippedCount) parts.push(`${skippedCount} already exist`);
      if (data.tokenSaved) parts.push('CivitAI token saved to .env');
      setCivitaiMsg(parts.join(' · ') || 'Nothing new to import');
      setCivitaiStatus('done');
    } catch (e) {
      setCivitaiMsg(`Error: ${e.message}`);
      setCivitaiStatus('error');
    }
  };

  const handleAddCivitaiModels = () => {
    // Apply URL patches to existing models that had matching names but no URL
    civitaiUrlUpdates.forEach(({ id, url }) => {
      if (onUpdateModel) onUpdateModel(id, { url });
    });
    // Add genuinely new models
    if (civitaiModels.length > 0) {
      onBulkAddModels(civitaiModels);
    }
    // Reset
    setCivitaiModels([]);
    setCivitaiUrlUpdates([]);
    setCivitaiSkipped(0);
    setCivitaiStatus('idle');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-xl glass-panel rounded-2xl p-6 border border-white/10 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-violet-400" />
            Add Download Link to Model List
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-white/10 mb-5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab('single')}
            className={`flex-1 py-2 rounded-lg transition-all ${
              tab === 'single' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Single Link
          </button>
          <button
            type="button"
            onClick={() => setTab('bulk')}
            className={`flex-1 py-2 rounded-lg transition-all ${
              tab === 'bulk' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Bulk Paste
          </button>
          <button
            type="button"
            onClick={() => setTab('civitai')}
            className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              tab === 'civitai' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" /> CivitAI File
          </button>
        </div>

        {tab === 'single' ? (
          <form onSubmit={handleSingleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Download URL (HuggingFace / CivitAI)
              </label>
              <div className="relative">
                <Link className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="https://huggingface.co/.../model.safetensors"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (!name && e.target.value) {
                      setName(e.target.value.split('/').pop());
                    }
                  }}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  ComfyUI Target Directory
                </label>
                <select
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-white outline-none focus:border-violet-500 cursor-pointer"
                >
                  {COMFYUI_MODEL_FOLDERS.map(folderName => (
                    <option key={folderName} value={folderName}>models/{folderName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Estimated Size (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 4.5 GB"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Custom Target Filename (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. flux1-dev-fp8.safetensors"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md shadow-violet-600/30"
              >
                Add Model Link
              </button>
            </div>
          </form>
        ) : tab === 'bulk' ? (
          <form onSubmit={handleBulkSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Paste Download Lines (URL target_folder optional_rename)
              </label>
              <textarea
                rows={8}
                placeholder={`https://civitai.com/api/download/models/2155386?token=abc checkpoints/SDXL/lustifySDXLNSFW_ggwpV7.safetensors\nhttps://civitai.com/api/download/models/2066914 loras/Wan2.2Lenovo.safetensors\nhttps://huggingface.co/.../model.safetensors checkpoints`}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Format: <code className="text-violet-300">URL target_path/filename</code> or <code className="text-violet-300">URL folder custom_filename</code>
                <br />
                <span className="text-slate-500">Supports HuggingFace & CivitAI download links (with or without API token, token auto-applied if configured)</span>
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isResolvingBulk}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isResolvingBulk || !bulkText.trim()}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-violet-600/30 flex items-center gap-2"
              >
                {isResolvingBulk ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Resolving & Fetching...</span>
                  </>
                ) : (
                  <span>Add All Items</span>
                )}
              </button>
            </div>
          </form>
        ) : (
          // ── CivitAI File Import Tab ──
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10">
              <p className="text-xs text-slate-300 leading-relaxed">
                Import all models from
                <code className="mx-1 text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded font-mono">civitai_download.txt</code>
                in the project root. Tokens are extracted from URLs and saved to
                <code className="mx-1 text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono">.env</code>
                automatically. Names are resolved from the CivitAI API for any nameless entries.
              </p>
            </div>

            {/* Fetch button + status */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={civitaiStatus === 'loading'}
                onClick={handleCivitaiImport}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-all"
              >
                {civitaiStatus === 'loading' ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Fetching names...</>
                ) : (
                  <><Download className="w-3.5 h-3.5" /> Read civitai_download.txt</>
                )}
              </button>
              {civitaiMsg && (
                <span className={`text-xs ${civitaiStatus === 'error' ? 'text-rose-400' : civitaiStatus === 'done' ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {civitaiStatus === 'error' && <AlertCircle className="inline w-3.5 h-3.5 mr-1" />}
                  {civitaiStatus === 'done' && <Check className="inline w-3.5 h-3.5 mr-1" />}
                  {civitaiMsg}
                </span>
              )}
            </div>

            {/* Dedup result preview */}
            {civitaiStatus === 'done' && (
              <div className="space-y-2 max-h-56 overflow-y-auto">

                {/* New models */}
                {civitaiModels.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        ✦ {civitaiModels.length} New Models
                      </span>
                    </div>
                    <div className="rounded-xl border border-emerald-500/20 divide-y divide-white/5 bg-emerald-500/5">
                      {civitaiModels.map((m, i) => (
                        <div key={m.id || i} className="flex items-center gap-2 px-3 py-1.5">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-white font-mono truncate">{m.name || '—'}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span className="text-blue-400 bg-blue-500/10 px-1.5 rounded text-[10px] font-bold">{m.folder}</span>
                              <span className="truncate opacity-70">{(m.url || '').replace('https://civitai.com/api/download/models/', '…/models/')}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* URL updates for existing nameless entries */}
                {civitaiUrlUpdates.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                        ⟳ {civitaiUrlUpdates.length} URL Patches (existing models with no URL)
                      </span>
                    </div>
                    <div className="rounded-xl border border-amber-500/20 divide-y divide-white/5 bg-amber-500/5">
                      {civitaiUrlUpdates.map(({ id, url }, i) => {
                        const existing = existingModels.find(m => m.id === id);
                        return (
                          <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-white font-mono truncate">{existing?.name || id}</div>
                              <div className="text-[11px] text-amber-400/70 truncate mt-0.5">
                                Adding URL → {url.replace('https://civitai.com/api/download/models/', '…/models/')}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Skipped count */}
                {civitaiSkipped > 0 && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-slate-800/60 border border-white/5">
                    <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="text-[11px] text-slate-500">
                      {civitaiSkipped} model{civitaiSkipped > 1 ? 's' : ''} skipped — already in your list (by name or CivitAI version ID)
                    </span>
                  </div>
                )}

                {/* Nothing to do */}
                {civitaiModels.length === 0 && civitaiUrlUpdates.length === 0 && (
                  <div className="flex items-center gap-2 px-3 py-3 rounded-xl bg-slate-800/60 border border-white/5">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-slate-400">All models from civitai_download.txt are already in your list.</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={civitaiModels.length === 0 && civitaiUrlUpdates.length === 0}
                onClick={handleAddCivitaiModels}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold shadow-md shadow-blue-600/30"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                {civitaiModels.length > 0 && civitaiUrlUpdates.length > 0
                  ? `Add ${civitaiModels.length} + Patch ${civitaiUrlUpdates.length}`
                  : civitaiModels.length > 0
                  ? `Add ${civitaiModels.length} Models`
                  : civitaiUrlUpdates.length > 0
                  ? `Apply ${civitaiUrlUpdates.length} URL Patches`
                  : 'Nothing to Import'
                }
              </button>
            </div>
          </div>

        )}

      </div>
    </div>
  );
}
