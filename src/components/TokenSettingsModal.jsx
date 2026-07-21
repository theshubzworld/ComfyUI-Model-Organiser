import React, { useState, useEffect } from 'react';
import { X, Key, Eye, EyeOff, Check, AlertCircle, Shield, ExternalLink, Trash2, FileCode } from 'lucide-react';

const HF_TOKEN_KEY = 'simplepod_hf_token';
const CIVITAI_TOKEN_KEY = 'simplepod_civitai_token';
const BACKEND = '';

export function loadTokens() {
  // Priority: localStorage (UI-set) > import.meta.env (.env at Vite build time)
  const lsHf = localStorage.getItem(HF_TOKEN_KEY) || '';
  const lsCivitai = localStorage.getItem(CIVITAI_TOKEN_KEY) || '';
  // Vite exposes VITE_* vars via import.meta.env (baked in at dev-server start)
  const envHf = import.meta.env.VITE_HF_TOKEN || '';
  const envCivitai = import.meta.env.VITE_CIVITAI_TOKEN || '';
  return {
    hfToken: lsHf || envHf,
    civitaiToken: lsCivitai || envCivitai,
  };
}

export function TokenSettingsModal({ isOpen, onClose }) {
  const [hfToken, setHfToken] = useState('');
  const [civitaiToken, setCivitaiToken] = useState('');
  const [showHf, setShowHf] = useState(false);
  const [showCivitai, setShowCivitai] = useState(false);
  const [saved, setSaved] = useState(false);
  const [backendStatus, setBackendStatus] = useState('idle'); // 'idle'|'loading'|'ok'|'error'
  const [envSource, setEnvSource] = useState({ hf: false, civitai: false });

  // Load tokens from both localStorage and backend .env on open
  useEffect(() => {
    if (!isOpen) return;
    setSaved(false);

    // Load from localStorage (user UI setting)
    const lsHf = localStorage.getItem(HF_TOKEN_KEY) || '';
    const lsCivitai = localStorage.getItem(CIVITAI_TOKEN_KEY) || '';
    setHfToken(lsHf);
    setCivitaiToken(lsCivitai);

    // Then try to load fresher values from backend .env
    setBackendStatus('loading');
    fetch(`${BACKEND}/api/tokens`)
      .then(r => r.json())
      .then(data => {
        setBackendStatus('ok');
        // Backend .env overrides if localStorage was empty
        if (data.hfToken && !lsHf) {
          setHfToken(data.hfToken);
          setEnvSource(s => ({ ...s, hf: true }));
        } else if (data.hfToken) {
          setEnvSource(s => ({ ...s, hf: true }));
        }
        if (data.civitaiToken && !lsCivitai) {
          setCivitaiToken(data.civitaiToken);
          setEnvSource(s => ({ ...s, civitai: true }));
        } else if (data.civitaiToken) {
          setEnvSource(s => ({ ...s, civitai: true }));
        }
      })
      .catch(() => setBackendStatus('error'));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const hf = hfToken.trim();
    const civitai = civitaiToken.trim();

    // 1. Save to localStorage (instant, browser-side)
    if (hf) localStorage.setItem(HF_TOKEN_KEY, hf);
    else localStorage.removeItem(HF_TOKEN_KEY);
    if (civitai) localStorage.setItem(CIVITAI_TOKEN_KEY, civitai);
    else localStorage.removeItem(CIVITAI_TOKEN_KEY);

    // 2. Save to .env via backend (persistent on disk)
    try {
      await fetch(`${BACKEND}/api/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hfToken: hf, civitaiToken: civitai }),
      });
      setEnvSource({ hf: Boolean(hf), civitai: Boolean(civitai) });
    } catch {
      // Backend not running — localStorage save still worked
    }

    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  };

  const clearToken = (type) => {
    if (type === 'hf') {
      setHfToken('');
      localStorage.removeItem(HF_TOKEN_KEY);
    } else {
      setCivitaiToken('');
      localStorage.removeItem(CIVITAI_TOKEN_KEY);
    }
  };

  const hfValid = !hfToken.trim() || hfToken.startsWith('hf_');
  const hfSet = Boolean(hfToken.trim());
  const civitaiSet = Boolean(civitaiToken.trim());

  const mask = (val) => val ? '●●●●●●●●' + val.slice(-4) : 'Not set';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-lg glass-panel rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">

        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-500" />

        <div className="p-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-white flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-violet-500/20 border border-violet-500/30">
                <Key className="w-4 h-4 text-violet-400" />
              </div>
              API Token Manager
            </h3>
            <div className="flex items-center gap-2">
              {/* Backend .env status badge */}
              <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${
                backendStatus === 'ok'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : backendStatus === 'error'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : 'bg-slate-800 text-slate-400 border-white/10'
              }`}>
                <FileCode className="w-3 h-3" />
                {backendStatus === 'ok' ? '.env synced' : backendStatus === 'error' ? '.env offline' : 'Loading…'}
              </span>
              <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Security notice */}
          <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300/90 leading-relaxed">
              Tokens are saved to <code className="font-mono text-amber-200 bg-amber-500/10 px-1 rounded">.env</code> on disk
              and in browser <code className="font-mono text-amber-200 bg-amber-500/10 px-1 rounded">localStorage</code>.
              The <code className="font-mono text-amber-200">.env</code> file is gitignored — never committed.
            </p>
          </div>

          {/* HuggingFace Token */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-amber-500/20 flex items-center justify-center text-[10px] font-black text-amber-400">HF</span>
                HuggingFace Access Token
              </label>
              <div className="flex items-center gap-2">
                {hfSet && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {envSource.hf ? 'From .env' : 'Configured'}
                  </span>
                )}
                <a
                  href="https://huggingface.co/settings/tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-slate-400 hover:text-violet-400 flex items-center gap-1 transition-colors"
                >
                  Get token <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            <div className="relative">
              <input
                type={showHf ? 'text' : 'password'}
                placeholder="hf_xxxxxxxxxxxxxxxxxxxx"
                value={hfToken}
                onChange={e => setHfToken(e.target.value)}
                className={`w-full px-4 pr-20 py-2.5 rounded-xl bg-slate-900/90 border text-xs text-white placeholder-slate-500 focus:outline-none font-mono transition-all ${
                  !hfValid ? 'border-rose-500 focus:border-rose-400' : 'border-white/15 focus:border-violet-500'
                }`}
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {hfSet && (
                  <button onClick={() => clearToken('hf')} className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors" title="Clear token">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => setShowHf(v => !v)} className="p-1 rounded text-slate-500 hover:text-white transition-colors">
                  {showHf ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {!hfValid && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-rose-400">
                <AlertCircle className="w-3.5 h-3.5" /> HF tokens start with <code className="font-mono">hf_</code>
              </p>
            )}
            <p className="mt-1.5 text-[11px] text-slate-500">
              Used for gated models (Llama, FLUX, etc.) — sent as <code className="font-mono text-slate-400">Authorization: Bearer</code> header
            </p>
          </div>

          {/* CivitAI Token */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center text-[10px] font-black text-blue-400">CA</span>
                CivitAI API Key
              </label>
              <div className="flex items-center gap-2">
                {civitaiSet && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {envSource.civitai ? 'From .env' : 'Configured'}
                  </span>
                )}
                <a
                  href="https://civitai.com/user/account"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-slate-400 hover:text-blue-400 flex items-center gap-1 transition-colors"
                >
                  Get key <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            <div className="relative">
              <input
                type={showCivitai ? 'text' : 'password'}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={civitaiToken}
                onChange={e => setCivitaiToken(e.target.value)}
                className="w-full px-4 pr-20 py-2.5 rounded-xl bg-slate-900/90 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-mono transition-all"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {civitaiSet && (
                  <button onClick={() => clearToken('civitai')} className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors" title="Clear token">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => setShowCivitai(v => !v)} className="p-1 rounded text-slate-500 hover:text-white transition-colors">
                  {showCivitai ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Appended as <code className="font-mono text-slate-400">?token=</code> on all CivitAI download URLs automatically
            </p>
          </div>

          {/* Token status row */}
          <div className="mb-5 p-3 rounded-xl bg-slate-900/60 border border-white/10 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full shrink-0 ${hfSet ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              <div className="min-w-0">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">HuggingFace</div>
                <div className={`text-xs font-mono truncate ${hfSet ? 'text-emerald-400' : 'text-slate-600'}`}>
                  {mask(hfToken.trim())}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full shrink-0 ${civitaiSet ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              <div className="min-w-0">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">CivitAI</div>
                <div className={`text-xs font-mono truncate ${civitaiSet ? 'text-emerald-400' : 'text-slate-600'}`}>
                  {mask(civitaiToken.trim())}
                </div>
              </div>
            </div>
          </div>

          {/* Storage info */}
          <div className="mb-5 flex items-center gap-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-violet-400" />
              <span><code className="font-mono text-slate-400">.env</code> file (disk, persistent)</span>
            </div>
            <span className="text-slate-700">+</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>localStorage (browser, instant)</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all">
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${
                saved
                  ? 'bg-emerald-600/40 text-emerald-300 border border-emerald-500 shadow-emerald-500/20'
                  : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-violet-600/30'
              }`}
            >
              {saved ? <><Check className="w-4 h-4" /> Saved!</> : <><Key className="w-4 h-4" /> Save to .env</>}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
