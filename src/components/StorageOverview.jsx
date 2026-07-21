import React from 'react';
import { HardDrive, Layers, ShieldAlert, PieChart, Sparkles } from 'lucide-react';
import { formatMB } from '../services/sizeCalculator';

export function StorageOverview({ breakdownData, storageQuotaGB, activeFolderFilter, setActiveFolderFilter, compact = false }) {
  const { totalMB, totalFormatted, breakdown } = breakdownData;
  const totalGB = totalMB / 1024;
  const isOverQuota = totalGB > storageQuotaGB;
  const quotaPercent = Math.min(100, (totalGB / storageQuotaGB) * 100);

  const categories = [
    { key: 'checkpoints', label: 'Checkpoints', color: '#8B5CF6', mb: breakdown.checkpoints },
    { key: 'diffusion_models', label: 'Diffusion / UNet', color: '#3B82F6', mb: breakdown.diffusion_models },
    { key: 'clip', label: 'CLIP / Encoders', color: '#06B6D4', mb: breakdown.clip },
    { key: 'vae', label: 'VAE', color: '#10B981', mb: breakdown.vae },
    { key: 'loras', label: 'LoRAs', color: '#F59E0B', mb: breakdown.loras },
    { key: 'controlnet', label: 'ControlNet', color: '#F43F5E', mb: breakdown.controlnet },
    { key: 'llm_gguf', label: 'LLM GGUF', color: '#D946EF', mb: breakdown.llm_gguf },
    { key: 'sams', label: 'Preprocessors/SAM', color: '#6366F1', mb: breakdown.sams },
    { key: 'other', label: 'Other Models', color: '#64748B', mb: breakdown.other },
  ];

  if (compact) {
    return (
      <div className="glass-panel rounded-2xl p-4 border border-white/10 space-y-3 shadow-xl sticky top-[4.5rem] lg:h-full lg:flex lg:flex-col">
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-extrabold text-white">Storage Overview</h3>
          </div>
            <span className="text-xs font-mono font-bold text-cyan-300 bg-slate-900 px-2 py-1 rounded-lg border border-white/10">
            {totalFormatted}
          </span>
        </div>

        {isOverQuota && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Exceeds Pod Quota! ({totalGB.toFixed(1)}GB / {storageQuotaGB}GB)</span>
          </div>
        )}

        {/* Visual Progress Bar */}
        <div>
          <div className="flex justify-between text-[11px] text-slate-400 mb-1.5 font-medium">
            <span>Allocation Visualizer</span>
            <span className="font-mono text-cyan-300">{quotaPercent.toFixed(1)}%</span>
          </div>
          <div className="h-3.5 w-full bg-slate-950 rounded-full overflow-hidden flex p-0.5 border border-white/15">
            {totalMB > 0 ? (
              (() => {
                const totalCapMB = Math.max(storageQuotaGB * 1024, totalMB);
                return categories.map(cat => {
                  if (cat.mb <= 0) return null;
                  const widthPct = (cat.mb / totalCapMB) * 100;
                  return (
                    <div
                      key={cat.key}
                      style={{ width: `${Math.max(1, widthPct)}%`, backgroundColor: cat.color }}
                      className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300 hover:brightness-125 cursor-pointer"
                      title={`${cat.label}: ${formatMB(cat.mb)}`}
                      onClick={() => setActiveFolderFilter(activeFolderFilter === cat.key ? 'all' : cat.key)}
                    />
                  );
                });
              })()
            ) : (
              <div className="w-full text-center text-[10px] text-slate-600">0 MB</div>
            )}
          </div>
        </div>

        {/* Category List */}
        <div className="space-y-1 pt-1 max-h-[calc(100vh-235px)] overflow-y-auto pr-1 lg:flex-1">
          {categories.map(cat => {
            const isActive = activeFolderFilter === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveFolderFilter(isActive ? 'all' : cat.key)}
                className={`w-full px-2.5 py-2 rounded-lg text-left border flex items-center justify-between transition-all text-xs ${
                  isActive 
                    ? 'bg-violet-600/30 border-violet-500 text-white shadow-md' 
                    : 'bg-slate-900/60 border-white/5 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="font-semibold truncate text-[10px]">{cat.label}</span>
                </div>
                <span className="font-mono text-[11px] font-bold text-slate-200 shrink-0">
                  {cat.mb > 0 ? formatMB(cat.mb) : '0 MB'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <section className="glass-panel rounded-2xl p-4 lg:p-5 shadow-xl border border-white/10">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-600/20 to-cyan-500/20 border border-violet-500/30 text-violet-400">
            <PieChart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              Storage Consumption & Category Split
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Visual allocation of models across standard ComfyUI directories
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-900/80 px-4 py-2.5 rounded-xl border border-white/10 shadow-inner">
          <div>
            <div className="text-xs text-slate-400 font-medium">Combined Download Volume</div>
            <div className="text-xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
              {totalFormatted}
            </div>
          </div>
        </div>
      </div>

      {/* Quota Warning Alert */}
      {isOverQuota && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/40 flex items-start gap-3.5 text-rose-300 shadow-xl">
          <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <strong className="font-bold text-rose-200 block text-sm">
              Storage Quota Alert! ({totalGB.toFixed(1)} GB / {storageQuotaGB} GB)
            </strong>
            <p>
              Your selected workflow package exceeds your cloud pod limit. Uncheck unused heavy workflows or adjust your target pod disk capacity in the top right header.
            </p>
          </div>
        </div>
      )}

      {/* Visual Multi-color Progress Segment Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-slate-300 font-semibold mb-2.5">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            Storage Allocation Visualizer
          </span>
          <span className="font-mono text-cyan-300">{quotaPercent.toFixed(1)}% of Pod Quota ({storageQuotaGB} GB)</span>
        </div>

        <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden flex p-0.5 border border-white/15 relative shadow-inner">
          {totalMB > 0 ? (
            (() => {
              const totalCapMB = Math.max(storageQuotaGB * 1024, totalMB);
              return categories.map(cat => {
                if (cat.mb <= 0) return null;
                const widthPct = (cat.mb / totalCapMB) * 100;
                return (
                  <div
                    key={cat.key}
                    style={{ width: `${Math.max(0.8, widthPct)}%`, backgroundColor: cat.color }}
                    className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300 hover:brightness-125 cursor-pointer relative group"
                    onClick={() => setActiveFolderFilter(activeFolderFilter === cat.key ? 'all' : cat.key)}
                  >
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-30 pointer-events-none whitespace-nowrap">
                      <div className="bg-slate-900 text-white text-xs px-3 py-1.5 rounded-xl border border-white/20 shadow-2xl font-mono">
                        {cat.label}: {formatMB(cat.mb)}
                      </div>
                    </div>
                  </div>
                );
              });
            })()
          ) : (
            <div className="w-full text-center text-xs text-slate-500 self-center font-mono">No workflows selected</div>
          )}
        </div>
      </div>

      {/* Category Metric Badges / Quick Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
        <button
          onClick={() => setActiveFolderFilter('all')}
          className={`p-2.5 rounded-xl text-left border transition-all ${
            activeFolderFilter === 'all' 
              ? 'bg-violet-600/30 border-violet-500 text-white shadow-lg shadow-violet-500/20' 
              : 'bg-slate-900/50 border-white/10 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">All Categories</div>
          <div className="text-base font-extrabold font-mono text-white mt-1">{totalFormatted}</div>
        </button>

        {categories.map(cat => {
          const isActive = activeFolderFilter === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveFolderFilter(isActive ? 'all' : cat.key)}
              className={`p-2.5 rounded-xl text-left border transition-all ${
                isActive 
                  ? 'bg-violet-600/30 border-violet-500 text-white shadow-lg shadow-violet-500/20' 
                  : 'bg-slate-900/50 border-white/10 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-400 font-bold truncate">
                <span className="truncate">{cat.label}</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }}></span>
              </div>
              <div className="text-base font-extrabold font-mono text-slate-200 mt-1">
                {cat.mb > 0 ? formatMB(cat.mb) : '0 MB'}
              </div>
            </button>
          );
        })}
      </div>

    </section>
  );
}
