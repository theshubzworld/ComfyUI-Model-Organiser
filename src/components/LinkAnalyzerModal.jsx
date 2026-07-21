import React, { useState, useEffect } from 'react';
import { 
  X, Check, AlertCircle, Link, Search, RefreshCw, Sparkles, 
  ShieldAlert, ShieldCheck, HardDrive, ArrowRight, Wrench, CheckCircle2, Trash2
} from 'lucide-react';

export function LinkAnalyzerModal({ isOpen, onClose, modelsList, onUpdateModel, onBulkUpdateModels, onRemoveModel }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [fixedIds, setFixedIds] = useState(new Set());
  const [applyingAll, setApplyingAll] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'stale_name' | 'duplicate_link' | 'missing' | 'search' | 'name' | 'size' | 'fixable'

  const runAnalysis = async () => {
    setAnalyzing(true);
    setErrorMsg('');
    try {
      let targetModels = modelsList && modelsList.length > 0 ? modelsList : [];
      if (!targetModels.length) {
        const catRes = await fetch('/api/load-model-list').catch(() => null);
        if (catRes && catRes.ok) {
          const catData = await catRes.json();
          targetModels = catData.models || [];
        }
      }

      const res = await fetch('/api/analyze-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models: targetModels })
      });
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      const data = await res.json();
      setReport(data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to connect to backend server');
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runAnalysis();
    } else {
      setReport(null);
      setFixedIds(new Set());
      setActiveFilter('all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const issues = report?.issues || [];
  const fixableIssues = issues.filter(i => (i.suggestedUrl || i.suggestedName || i.type === 'duplicate_link') && !fixedIds.has(i.id));

  const counts = {
    all: issues.length,
    stale_name: issues.filter(i => i.type === 'stale_name').length,
    duplicate_link: issues.filter(i => i.type === 'duplicate_link').length,
    missing: issues.filter(i => i.type === 'missing').length,
    search: issues.filter(i => i.type === 'search').length,
    name: issues.filter(i => i.type === 'name').length,
    size: issues.filter(i => i.type === 'size').length,
    fixable: fixableIssues.length,
  };

  const filteredIssues = issues.filter(item => {
    if (fixedIds.has(item.id)) return false;
    if (activeFilter === 'fixable') return Boolean(item.suggestedUrl || item.suggestedName || item.type === 'duplicate_link');
    if (activeFilter !== 'all') return item.type === activeFilter;
    return true;
  });

  const handleFixSingle = (item) => {
    if (item.type === 'duplicate_link') {
      if (onRemoveModel) onRemoveModel(item.id);
      setFixedIds(prev => new Set(prev).add(item.id));
      return;
    }

    const updates = {};
    if (item.suggestedUrl) updates.url = item.suggestedUrl;
    if (item.suggestedSize && item.suggestedSize !== 'Unknown') updates.size = item.suggestedSize;
    if (item.suggestedName) updates.name = item.suggestedName;

    onUpdateModel(item.id, updates);
    setFixedIds(prev => new Set(prev).add(item.id));
  };

  const handleFixAll = async () => {
    if (!fixableIssues.length) return;
    setApplyingAll(true);
    const bulkUpdates = {};

    fixableIssues.forEach(item => {
      if (item.type === 'duplicate_link') {
        if (onRemoveModel) onRemoveModel(item.id);
      } else {
        bulkUpdates[item.id] = {
          url: item.suggestedUrl || item.currentUrl,
          size: item.suggestedSize && item.suggestedSize !== 'Unknown' ? item.suggestedSize : undefined,
          name: item.suggestedName || undefined,
        };
      }
    });

    if (Object.keys(bulkUpdates).length > 0) {
      if (onBulkUpdateModels) {
        onBulkUpdateModels(bulkUpdates);
      } else {
        Object.entries(bulkUpdates).forEach(([id, updates]) => {
          onUpdateModel(id, updates);
        });
      }
    }

    setFixedIds(prev => {
      const updated = new Set(prev);
      fixableIssues.forEach(item => updated.add(item.id));
      return updated;
    });
    setApplyingAll(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="glass-panel w-full max-w-4xl max-h-[90vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-6 border-b flex items-center justify-between theme-surface">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="theme-title text-lg font-extrabold flex items-center gap-2">
                Link Health & Missing Link Analyzer
              </h2>
              <p className="text-xs text-slate-400">
                Audits download URLs, detects duplicate links, and resolves stale/wrong cached filenames
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Loading state */}
          {analyzing && (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-sm font-semibold text-slate-300">Auditing download links & detecting duplicate name mismatches...</p>
              <p className="text-xs text-slate-500">Checking HuggingFace, CivitAI, models.txt, and master catalog</p>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!analyzing && report && (
            <>
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="theme-surface p-4 rounded-2xl border">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Health Score</div>
                  <div className={`text-2xl font-black font-mono mt-1 ${
                    report.healthScore >= 90 ? 'text-emerald-400' : report.healthScore >= 70 ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {report.healthScore}%
                  </div>
                </div>

                <div className="theme-surface p-4 rounded-2xl border">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Valid Direct Links</div>
                  <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                    {report.validCount} / {report.totalAudited}
                  </div>
                </div>

                <div className="theme-surface p-4 rounded-2xl border">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Link Issues Found</div>
                  <div className={`text-2xl font-black font-mono mt-1 ${issues.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {issues.length}
                  </div>
                </div>

                <div className="theme-surface p-4 rounded-2xl border">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Auto-Fixable</div>
                  <div className="text-2xl font-black font-mono text-indigo-400 mt-1">
                    {fixableIssues.length}
                  </div>
                </div>
              </div>

              {/* Action Bar & Filter Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                {/* Category Filters */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl theme-surface border">
                  {[
                    { id: 'all', label: 'All', count: counts.all },
                    { id: 'stale_name', label: 'Stale Name Mismatches', count: counts.stale_name },
                    { id: 'duplicate_link', label: 'Duplicate Links', count: counts.duplicate_link },
                    { id: 'missing', label: 'Missing Links', count: counts.missing },
                    { id: 'search', label: 'Search Placeholders', count: counts.search },
                    { id: 'name', label: 'Unresolved Names', count: counts.name },
                    { id: 'size', label: 'Missing Sizes', count: counts.size },
                    { id: 'fixable', label: 'Auto-Fixable', count: counts.fixable },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        activeFilter === tab.id
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      {tab.label} <span className="opacity-75">({tab.count})</span>
                    </button>
                  ))}
                </div>

                {/* Auto-Fix All Button */}
                {fixableIssues.length > 0 && (
                  <button
                    onClick={handleFixAll}
                    disabled={applyingAll}
                    className="h-9 px-4 rounded-xl text-xs font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{applyingAll ? 'Applying Fixes...' : `Auto-Fix All (${fixableIssues.length})`}</span>
                  </button>
                )}
              </div>

              {/* Issue List */}
              {filteredIssues.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3 theme-surface rounded-2xl border p-6 text-center">
                  <ShieldCheck className="w-12 h-12 text-emerald-400" />
                  <h3 className="text-base font-bold text-slate-200">No Issues Found in this Category!</h3>
                  <p className="text-xs text-slate-400 max-w-md">
                    All audited download links and filenames are healthy, unique, and resolved.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredIssues.map((item, idx) => {
                    const hasFix = Boolean(item.suggestedUrl || item.suggestedName || item.type === 'duplicate_link');
                    return (
                      <div key={item.id || idx} className="theme-surface p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:border-indigo-500/40">
                        
                        <div className="space-y-1.5 max-w-xl">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-100">{item.name}</span>
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                              {item.folder}
                            </span>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                              item.type === 'stale_name' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                              item.type === 'duplicate_link' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                              item.type === 'missing' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                              item.type === 'search' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                              item.type === 'name' ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' :
                              'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            }`}>
                              {item.type === 'stale_name' ? 'Stale Name Mismatch' :
                               item.type === 'duplicate_link' ? 'Duplicate Link' :
                               item.type === 'missing' ? 'Missing URL' :
                               item.type === 'search' ? 'Search Placeholder' :
                               item.type === 'name' ? 'Unresolved Name' : 'Missing Size'}
                            </span>
                          </div>

                          <div className="text-xs font-mono text-slate-400 truncate max-w-md">
                            Current Link: <span className="text-slate-300">{item.currentUrl || 'None'}</span>
                          </div>

                          {item.note && (
                            <div className="text-[11px] text-amber-400/90 font-medium">
                              💡 {item.note}
                            </div>
                          )}

                          {item.suggestedName && item.suggestedName !== item.name && (
                            <div className="text-xs font-mono text-emerald-400 flex items-center gap-1.5 truncate max-w-md">
                              <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>True Filename: <strong className="text-emerald-300">{item.suggestedName}</strong></span>
                            </div>
                          )}
                        </div>

                        {hasFix ? (
                          <button
                            onClick={() => handleFixSingle(item)}
                            className={`h-8 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-md active:scale-95 transition-all ${
                              item.type === 'duplicate_link'
                                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                            }`}
                          >
                            {item.type === 'duplicate_link' ? <Trash2 className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                            <span>{item.type === 'duplicate_link' ? 'Remove Duplicate' : 'Refetch True Filename'}</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500 font-medium italic">No auto-match</span>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}

            </>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t theme-surface flex items-center justify-between">
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="h-9 px-3 rounded-xl text-xs font-bold theme-surface text-slate-300 border border-white/10 hover:bg-white/5 flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Re-Audit Links</span>
          </button>

          <button
            onClick={onClose}
            className="h-9 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
