import React from 'react';
import { 
  HardDrive, Plus, Cpu, RefreshCw, 
  LayoutDashboard, Layers, Terminal, Save, Check, Key, Compass,
  Sun, Moon, Wrench, FileJson, LogOut, Sparkles
} from 'lucide-react';

export default function Header({ 
  totalMB, 
  storageQuotaGB, 
  setStorageQuotaGB, 
  activeModelsCount, 
  missingCount,
  isFetchingSizes,
  fetchProgress,
  onFetchMissingSizes,
  onSaveToDisk,
  isSaving,
  saveSuccess,
  activeTab,
  setActiveTab,
  onOpenAddModal, 
  onOpenExportModal,
  onOpenTokenSettings,
  onOpenLinkAnalyzer,
  hasTokens,
  theme = 'dark',
  onToggleTheme,
  user,
  onSignOut
}) {
  const totalGB = (totalMB / 1024).toFixed(2);
  const quotaPercent = Math.min(100, (totalGB / storageQuotaGB) * 100).toFixed(1);
  const isOverQuota = Number(totalGB) > storageQuotaGB;

  return (
    <header className="theme-header sticky top-0 z-40 w-full border-b backdrop-blur-2xl transition-all shadow-xl bg-slate-950/80">
      
      {/* ── ROW 1: CORE BRANDING, WORKSPACE TABS & USER ACCOUNT ── */}
      <div className="w-full flex items-center justify-between gap-4 px-4 lg:px-8 py-3">
        
        {/* Left Section: Logo & Branding */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h1 className="theme-title text-base font-black tracking-tight flex items-center gap-2">
              SimplePod
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30">
                Studio
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium hidden sm:block">
              Workflow Model Reorganizer & Storage Calculator
            </p>
          </div>
        </div>

        {/* Center Section: Workspace Navigation Tabs */}
        <nav className="theme-surface hidden md:flex items-center gap-1.5 p-1.5 rounded-2xl border shadow-inner">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'dashboard'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30 scale-105'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Workflows & Storage</span>
          </button>

          <button
            onClick={() => setActiveTab('manager')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'manager'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30 scale-105'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Model List ({activeModelsCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('extractor')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'extractor'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30 scale-105'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>Link Extractor</span>
          </button>

          <button
            onClick={() => setActiveTab('explorer')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'explorer'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30 scale-105'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Model Explorer</span>
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'export'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30 scale-105'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Export Script</span>
          </button>
        </nav>

        {/* Right Section: Add Model, Tokens, Theme & Account */}
        <div className="flex items-center gap-2 shrink-0">
          
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all active:scale-95 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Add Model</span>
          </button>

          <button
            onClick={onOpenTokenSettings}
            className="theme-surface relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-200 text-xs font-bold border transition-all active:scale-95"
            title="Configure HuggingFace & CivitAI API tokens"
          >
            <Key className="w-3.5 h-3.5 text-violet-400" />
            <span className="hidden sm:inline">Tokens</span>
            {hasTokens && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-950" />
            )}
          </button>

          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="theme-surface h-9 w-9 flex items-center justify-center rounded-xl text-slate-200 border transition-all active:scale-95"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            </button>
          )}

          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <div className="theme-surface h-9 px-3 flex items-center gap-2 rounded-xl border">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Connected to Supabase Cloud" />
                <span className="text-xs text-slate-300 font-mono font-bold max-w-[90px] truncate" title={user.email}>
                  {user.email.split('@')[0]}
                </span>
                {user.email && user.email.toLowerCase() === 'shubzveo@gmail.com' && (
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                    Master
                  </span>
                )}
              </div>
              <button
                onClick={onSignOut}
                className="h-9 p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold transition-all active:scale-95"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 2: SECONDARY WORKSPACE UTILITY TOOLBAR (STORAGE METERS & TOOLBOX) ── */}
      <div className="w-full bg-slate-900/60 border-t border-white/5 px-4 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        
        {/* Mobile Navigation Tabs (visible only on small screens) */}
        <div className="flex md:hidden items-center gap-1 overflow-x-auto w-full pb-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-violet-600 text-white' : 'text-slate-400'}`}
          >
            Workflows
          </button>
          <button
            onClick={() => setActiveTab('manager')}
            className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${activeTab === 'manager' ? 'bg-violet-600 text-white' : 'text-slate-400'}`}
          >
            Model List
          </button>
          <button
            onClick={() => setActiveTab('extractor')}
            className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${activeTab === 'extractor' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
          >
            Link Extractor
          </button>
          <button
            onClick={() => setActiveTab('explorer')}
            className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${activeTab === 'explorer' ? 'bg-violet-600 text-white' : 'text-slate-400'}`}
          >
            Explorer
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${activeTab === 'export' ? 'bg-violet-600 text-white' : 'text-slate-400'}`}
          >
            Export
          </button>
        </div>

        {/* Left: Storage Quota Bar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-white/10 shadow-inner">
            <HardDrive className={`w-3.5 h-3.5 ${isOverQuota ? 'text-rose-400 animate-pulse' : 'text-cyan-400'}`} />
            <span className="text-[11px] text-slate-400 font-bold">Total Storage:</span>
            <span className={`text-xs font-mono font-black ${isOverQuota ? 'text-rose-400' : 'text-cyan-400'}`}>
              {totalGB} GB
            </span>
            <span className="text-[10px] text-slate-400 font-mono font-bold">
              ({quotaPercent}%)
            </span>
            <select
              value={storageQuotaGB}
              onChange={(e) => setStorageQuotaGB(Number(e.target.value))}
              className="bg-slate-900 text-slate-200 text-[10px] px-2 py-0.5 rounded-lg border border-white/15 outline-none font-bold cursor-pointer"
            >
              <option value={50}>Quota: 50GB</option>
              <option value={80}>Quota: 80GB</option>
              <option value={100}>Quota: 100GB</option>
              <option value={150}>Quota: 150GB</option>
              <option value={200}>Quota: 200GB</option>
              <option value={500}>Quota: 500GB</option>
            </select>
          </div>
        </div>

        {/* Right: Quick Action Utility Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* LINK HEALTH ANALYZER */}
          {onOpenLinkAnalyzer && (
            <button
              onClick={onOpenLinkAnalyzer}
              className="h-8 flex items-center gap-1.5 px-3 rounded-xl text-xs font-bold border transition-all active:scale-95 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/40"
              title="Audit model links, find missing/search URLs, and auto-fix links"
            >
              <Wrench className="w-3.5 h-3.5 text-indigo-400" />
              <span>Link Analyzer</span>
            </button>
          )}

          {/* FETCH MISSING SIZES */}
          <button
            onClick={onFetchMissingSizes}
            disabled={isFetchingSizes}
            className={`h-8 flex items-center gap-1.5 px-3 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
              isFetchingSizes 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 cursor-wait'
                : missingCount > 0
                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-slate-950 text-slate-300 border-white/10 hover:bg-slate-800'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetchingSizes ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
            <span>
              {isFetchingSizes 
                ? `Scanning (${fetchProgress.done}/${fetchProgress.total})`
                : missingCount > 0
                ? `Fetch Sizes & Names (${missingCount})`
                : 'Re-Scan Sizes & Names'}
            </span>
          </button>

          {/* SAVE & SYNC TO DISK */}
          <button
            onClick={onSaveToDisk}
            disabled={isSaving}
            className={`h-8 flex items-center gap-1.5 px-3 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
              saveSuccess 
                ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500 shadow-md'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/50 shadow-md shadow-emerald-600/20'
            }`}
            title="Save updated links and sizes permanently to download.txt & model-list.txt"
          >
            {saveSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saveSuccess ? 'Saved!' : isSaving ? 'Saving...' : 'Save to txt'}</span>
          </button>

          {/* Export Script Quick Action */}
          <button
            onClick={onOpenExportModal}
            className="h-8 flex items-center gap-1.5 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-violet-600/20 transition-all active:scale-95"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>

      </div>

    </header>
  );
}
