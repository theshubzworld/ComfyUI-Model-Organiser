import React, { useState, useEffect } from 'react';
import { 
  X, Check, AlertCircle, Link, Search, RefreshCw, Sparkles, 
  ShieldAlert, ShieldCheck, HardDrive, ArrowRight, Wrench, CheckCircle2, Copy
} from 'lucide-react';

export function LinkAnalyzerModal({ isOpen, onClose, modelsList, onUpdateModel, onBulkUpdateModels }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [fixedIds, setFixedIds] = useState(new Set());
  const [applyingAll, setApplyingAll] = useState(false);

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const issues = report?.issues || [];
  const fixableIssues = issues.filter(i => i.suggestedUrl && !fixedIds.has(i.id));

  const handleFixSingle = (modelId, newUrl, newSize) => {
    const updates = { url: newUrl };
    if (newSize && newSize !== 'Unknown') updates.size = newSize;
    onUpdateModel(modelId, updates);
    setFixedIds(prev => new Set(prev).add(modelId));
  };

  const handleFixAll = async () => {
    if (!fixableIssues.length) return;
    setApplyingAll(true);
    const bulkUpdates = {};
    fixableIssues.forEach(item => {
      bulkUpdates[item.id] = {
        url: item.suggestedUrl,
        size: item.suggestedSize && item.suggestedSize !== 'Unknown' ? item.suggestedSize : undefined
      };
    });

    if (onBulkUpdateModels) {
      onBulkUpdateModels(bulkUpdates);
    } else {
      Object.entries(bulkUpdates).forEach(([id, updates]) => {
        onUpdateModel(id, updates);
      });
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
                Audits model download links, identifies missing/search placeholders, and auto-matches direct links
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
              <p className="text-sm font-semibold text-slate-300">Auditing download links & searching master databases...</p>
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
                  <div className={`text-xl font-black font-mono mt-1 ${
                    report.healthScore >= 90 ? 'text-emerald-400' : report.healthScore >= 70 ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {report.healthScore}%
                  </div>
                </div>

                <div className="theme-surface p-4 rounded-2xl border">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Valid Direct Links</div>
                  <div className="text-xl font-black font-mono text-emerald-400 mt-1">
                    {report.validCount} / {report.totalAudited}
                  </div>
                </div>

                <div className="theme-surface p-4 rounded-2xl border">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Link Issues Found</div>
                  <div className="text-xl font-black font-mono text-amber-400 mt-1">
                    {report.issues.length}
                  </div>
                </div>

                <div className="theme-surface p-4 rounded-2xl border">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Auto-Fixable</div>
                  <div className="text-xl font-black font-mono text-cyan-300 mt-1">
                    {fixableIssues.length}
                  </div>
                </div>
              </div>

              {/* Batch Action Toolbar */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-slate-200">
                    {fixableIssues.length > 0
                      ? `${fixableIssues.length} missing/placeholder links can be auto-repaired immediately`
                      : 'All matched issues have been fixed or resolved!'}
                  </span>
                </div>

                <button
                  onClick={handleFixAll}
                  disabled={!fixableIssues.length || applyingAll}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all shrink-0"
                >
                  {applyingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Auto-Fix All ({fixableIssues.length})</span>
                </button>
              </div>

              {/* Issues List */}
              {issues.length === 0 ? (
                <div className="py-12 text-center space-y-2 glass-panel rounded-2xl border">
                  <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto" />
                  <h4 className="theme-title text-sm font-bold">All Links Are 100% Healthy!</h4>
                  <p className="text-xs text-slate-400">No missing or placeholder URLs detected in your model list.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Detected Issues & Suggested Fixes ({issues.length})
                  </h3>

                  <div className="space-y-3">
                    {issues.map(item => {
                      const isFixed = fixedIds.has(item.id);

                      return (
                        <div
                          key={item.id}
                          className={`p-4 rounded-2xl border transition-all space-y-2.5 ${
                            isFixed
                              ? 'bg-emerald-950/20 border-emerald-500/30'
                              : item.type === 'missing'
                              ? 'theme-surface border-amber-500/30'
                              : 'theme-surface border-rose-500/30'
                          }`}
                        >
                          {/* Item Header */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 truncate">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                                item.type === 'missing' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              }`}>
                                {item.type === 'missing' ? 'Missing Link' : item.type === 'search' ? 'Search Placeholder' : 'Broken Link'}
                              </span>
                              <span className="theme-title font-mono text-xs font-bold truncate">{item.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">({item.folder})</span>
                            </div>

                            {isFixed && (
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-400" /> Fixed
                              </span>
                            )}
                          </div>

                          {/* Current bad link */}
                          {item.currentUrl && (
                            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2 truncate">
                              <span className="text-slate-500 shrink-0">Current:</span>
                              <span className="truncate underline opacity-75">{item.currentUrl}</span>
                            </div>
                          )}

                          {/* Suggested Replacement Link */}
                          {item.suggestedUrl ? (
                            <div className="p-3 rounded-xl theme-surface border border-indigo-500/30 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-indigo-400" /> Suggested Direct Download Link ({item.confidence || 'High'} Match)
                                </div>
                                <div className="text-xs font-mono text-emerald-400 truncate mt-0.5" title={item.suggestedUrl}>
                                  {item.suggestedUrl}
                                </div>
                              </div>

                              {!isFixed && (
                                <button
                                  onClick={() => handleFixSingle(item.id, item.suggestedUrl, item.suggestedSize)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 shadow"
                                >
                                  <Check className="w-3.5 h-3.5" /> Apply
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 italic">
                              No exact match found in local master list. Use Search to locate model.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t theme-surface flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
