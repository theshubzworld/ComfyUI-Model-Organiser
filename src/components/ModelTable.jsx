import React, { useState, useMemo, memo, useCallback } from 'react';
import { 
  Folder, Link, Trash2, Edit2, Copy, Plus, 
  Check, AlertCircle, Search, RefreshCw, Save,
  ChevronDown, ChevronRight, LayoutGrid, List, HardDrive, Filter, Wrench, Tag, RotateCcw, Sliders
} from 'lucide-react';
import { getCategoryBadgeColor, parseSizeToMB, formatMB } from '../services/sizeCalculator';
import { COMFYUI_MODEL_FOLDERS } from '../data/comfyuiFolders';

export const ModelTable = memo(function ModelTable({ 
  modelsList, 
  onUpdateModel, 
  onRemoveModel, 
  activeFolderFilter: externalFolderFilter = 'all', 
  onOpenAddModal,
  onFetchMissingSizes,
  isFetchingSizes,
  onSaveToDisk,
  saveSuccess,
  onSearchModel,
  onOpenSearch,
  onOpenLinkAnalyzer,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [selectedFolderTab, setSelectedFolderTab] = useState('all');
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' | 'flat'
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [showNodeTypes, setShowNodeTypes] = useState(false);

  // XLS Partition Column Width State
  const DEFAULT_COL_WIDTHS = useMemo(() => ({
    name: 280,
    size: 110,
    folder: 180,
    url: 480,
    actions: 100
  }), []);

  const [colWidths, setColWidths] = useState(() => {
    try {
      const saved = localStorage.getItem('simplepod_col_widths');
      return saved ? { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) } : DEFAULT_COL_WIDTHS;
    } catch {
      return DEFAULT_COL_WIDTHS;
    }
  });

  const handleResizerMouseDown = (colKey, e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || DEFAULT_COL_WIDTHS[colKey];

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(70, startWidth + deltaX);
      setColWidths(prev => {
        const next = { ...prev, [colKey]: newWidth };
        try { localStorage.setItem('simplepod_col_widths', JSON.stringify(next)); } catch {}
        return next;
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleResizerDoubleClick = (colKey) => {
    setColWidths(prev => {
      const next = { ...prev, [colKey]: DEFAULT_COL_WIDTHS[colKey] };
      try { localStorage.setItem('simplepod_col_widths', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleResetAllWidths = () => {
    setColWidths(DEFAULT_COL_WIDTHS);
    try { localStorage.setItem('simplepod_col_widths', JSON.stringify(DEFAULT_COL_WIDTHS)); } catch {}
  };

  const folderOptions = COMFYUI_MODEL_FOLDERS;



  // 1. Calculate per-folder statistics (counts & total size)
  const folderStats = useMemo(() => {
    const stats = {};
    let grandTotalMB = 0;

    modelsList.forEach(m => {
      const folder = (m.folder || 'other').toLowerCase();
      const mb = parseSizeToMB(m.size);
      grandTotalMB += mb;

      if (!stats[folder]) {
        stats[folder] = { count: 0, totalMB: 0, models: [] };
      }
      stats[folder].count += 1;
      stats[folder].totalMB += mb;
      stats[folder].models.push(m);
    });

    return { stats, grandTotalMB };
  }, [modelsList]);

  // Active filter effectively combines externalFolderFilter, selectedFolderTab & searchQuery
  const activeFolder = selectedFolderTab !== 'all' ? selectedFolderTab : externalFolderFilter;

  const filteredModels = useMemo(() => {
    return modelsList.filter(m => {
      const matchesFolder = activeFolder === 'all' || (m.folder || '').toLowerCase().includes(activeFolder);
      const matchesSearch = !searchQuery || 
        (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.url || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.folder || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFolder && matchesSearch;
    });
  }, [modelsList, activeFolder, searchQuery]);

  // Group filtered models by folder for Category View
  const groupedModels = useMemo(() => {
    const groups = {};
    filteredModels.forEach(m => {
      const folderKey = (m.folder || 'other').toLowerCase();
      if (!groups[folderKey]) {
        groups[folderKey] = {
          folder: folderKey,
          models: [],
          totalMB: 0
        };
      }
      groups[folderKey].models.push(m);
      groups[folderKey].totalMB += parseSizeToMB(m.size);
    });
    return Object.values(groups).sort((a, b) => b.models.length - a.models.length);
  }, [filteredModels]);

  const toggleGroupCollapse = (folderKey) => {
    setCollapsedGroups(prev => ({ ...prev, [folderKey]: !prev[folderKey] }));
  };

  const handleCopyLink = (url, id) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderHeaderTh = (label, colKey, align = 'left') => {
    const width = colWidths[colKey] || DEFAULT_COL_WIDTHS[colKey];
    return (
      <th 
        key={colKey}
        style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
        className={`relative py-3 px-4 uppercase tracking-wider font-extrabold text-[10px] select-none text-${align} group/col overflow-hidden text-ellipsis whitespace-nowrap`}
      >
        <div className="flex items-center gap-1 truncate">
          <span>{label}</span>
        </div>
        
        {/* XLS Style Resizer Handle */}
        <div
          onMouseDown={(e) => handleResizerMouseDown(colKey, e)}
          onDoubleClick={() => handleResizerDoubleClick(colKey)}
          title="Drag left/right to resize column width • Double-click to reset width"
          className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center hover:bg-indigo-500/20 z-20 group/divider"
        >
          <div className="w-[2px] h-full bg-white/10 group-hover/divider:bg-indigo-400 group-hover/col:bg-indigo-400/60 transition-colors" />
        </div>
      </th>
    );
  };

  const renderTableRow = (model) => {
    const badgeStyle = getCategoryBadgeColor(model.folder);
    const isEditing = editingId === model.id;
    const hasUrl = Boolean(model.url);
    const isUnknown = !model.size || model.size === 'Unknown';

    return (
      <tr key={model.id} className="hover:bg-white/[0.04] transition-colors group">
        
        {/* Model Filename */}
        <td 
          style={{ width: `${colWidths.name}px`, minWidth: `${colWidths.name}px`, maxWidth: `${colWidths.name}px` }}
          className="py-3.5 px-4 font-mono font-medium text-slate-100 overflow-hidden"
        >
          {isEditing ? (
            <input
              type="text"
              value={model.name}
              onChange={(e) => onUpdateModel(model.id, { name: e.target.value })}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') setEditingId(null);
              }}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-violet-500 text-xs text-white outline-none font-mono"
            />
          ) : (
            <div className="flex items-center gap-2 truncate">
              <span className="truncate font-bold text-white text-xs sm:text-sm" title={model.name}>{model.name}</span>
              {showNodeTypes && model.nodeType && (
                <span 
                  className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0 font-mono"
                  title={`ComfyUI Loader Node: ${model.nodeType}`}
                >
                  {model.nodeType}
                </span>
              )}
            </div>
          )}
        </td>

        {/* Size */}
        <td 
          style={{ width: `${colWidths.size}px`, minWidth: `${colWidths.size}px`, maxWidth: `${colWidths.size}px` }}
          className="py-3.5 px-4 font-mono font-bold text-xs shrink-0 whitespace-nowrap overflow-hidden"
        >
          {isEditing ? (
            <input
              type="text"
              value={model.size || ''}
              placeholder="e.g. 4.5 GB"
              onChange={(e) => onUpdateModel(model.id, { size: e.target.value })}
              className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-violet-500 text-xs text-white outline-none font-mono"
            />
          ) : (
            <div className="flex items-center gap-1.5 truncate">
              <span className={isUnknown ? 'text-amber-400/90 font-normal text-xs italic' : 'text-cyan-300 font-extrabold'}>
                {model.size || 'Unknown'}
              </span>
              {isUnknown && (
                <button
                  onClick={onFetchMissingSizes}
                  title="Fetch size for this model"
                  className="p-1 rounded text-amber-400 hover:bg-amber-500/10 transition-colors shrink-0"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </td>

        {/* Target Folder Selector */}
        <td 
          style={{ width: `${colWidths.folder}px`, minWidth: `${colWidths.folder}px`, maxWidth: `${colWidths.folder}px` }}
          className="py-3.5 px-4 overflow-hidden"
        >
          <select
            value={model.folder || 'checkpoints'}
            onChange={(e) => onUpdateModel(model.id, { folder: e.target.value })}
            className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold border outline-none cursor-pointer transition-all truncate ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
          >
            {(folderOptions.includes(model.folder) ? folderOptions : [model.folder || 'checkpoints', ...folderOptions]).map(f => (
              <option key={f} value={f} className="bg-slate-900 text-white font-normal">
                models/{f}
              </option>
            ))}
          </select>
        </td>

        {/* Source URL */}
        <td 
          style={{ width: `${colWidths.url}px`, minWidth: `${colWidths.url}px`, maxWidth: `${colWidths.url}px` }}
          className="py-3.5 px-4 overflow-hidden"
        >
          {isEditing ? (
            <input
              type="text"
              value={model.url || ''}
              placeholder="Paste a direct HuggingFace, CivitAI, or other download URL"
              onChange={(e) => onUpdateModel(model.id, { url: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') setEditingId(null);
              }}
              aria-label={`Download URL for ${model.name}`}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-violet-500 text-xs text-white outline-none font-mono"
            />
          ) : (
            <div className="flex items-center gap-2 w-full truncate">
              {hasUrl ? (
                <>
                  <a
                    href={model.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-cyan-300 font-mono text-[11px] flex items-center gap-1.5 transition-colors truncate min-w-0 flex-1"
                    title={model.url}
                  >
                    <Link className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                    <span className="truncate">{model.url}</span>
                  </a>
                  {model.error && (
                    <span className={`px-1.5 py-0.5 rounded-lg text-[9px] font-extrabold uppercase border tracking-wider shrink-0 ${
                      model.error.includes('401') || model.error.includes('403')
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/35'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/35'
                    }`} title={`Link returned error: ${model.error}`}>
                      {model.error}
                    </span>
                  )}
                  <button
                    onClick={() => handleCopyLink(model.url, model.id)}
                    title="Copy URL"
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                  >
                    {copiedId === model.id ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 text-amber-400/90 text-[11px] font-semibold truncate">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate">No download link found</span>
                  {onSearchModel && (
                    <button
                      onClick={() => onSearchModel(model.id, model.name)}
                      className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold transition-all shrink-0"
                      title="Search for this model on HuggingFace or CivitAI"
                    >
                      <Search className="w-3 h-3" /> Find
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </td>

        {/* Action Buttons */}
        <td 
          style={{ width: `${colWidths.actions}px`, minWidth: `${colWidths.actions}px`, maxWidth: `${colWidths.actions}px` }}
          className="py-3.5 px-3 text-center overflow-hidden"
        >

          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={() => setEditingId(isEditing ? null : model.id)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isEditing ? "Save" : "Edit"}
            >
              {isEditing ? <Check className="w-4 h-4 text-emerald-400" /> : <Edit2 className="w-4 h-4" />}
            </button>

            <button
              onClick={() => onRemoveModel(model.id)}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Remove model"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {onSearchModel && (
              <button
                onClick={() => onSearchModel(model.id, model.name)}
                className={`p-2 rounded-xl transition-colors ${
                  !model.url
                    ? 'text-indigo-400 hover:text-indigo-200 hover:bg-indigo-500/20 animate-pulse'
                    : 'text-slate-600 hover:text-indigo-300 hover:bg-indigo-500/10'
                }`}
                title={`Search for "${model.name}" on HuggingFace or CivitAI`}
              >
                <Search className="w-4 h-4" />
              </button>
            )}
          </div>
        </td>

      </tr>
    );
  };

  return (
    <section className="sv-card rounded-3xl p-6 md:p-8 shadow-2xl border border-white/10 w-full space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-400">
            <Folder className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
              Model Download List ({filteredModels.length} items)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Reorganize destination folders, customize filenames, edit URLs, and fetch missing sizes
            </p>
          </div>
        </div>

        {/* Actions & View Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          
          {onOpenLinkAnalyzer && (
            <button
              onClick={onOpenLinkAnalyzer}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition-all active:scale-95 shrink-0"
              title="Analyze missing or bad links and auto-fix"
            >
              <Wrench className="w-3.5 h-3.5 text-indigo-400" />
              <span>Link Analyzer</span>
            </button>
          )}

          <button
            onClick={() => setShowNodeTypes(prev => !prev)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-95 shrink-0 ${
              showNodeTypes
                ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 shadow-md shadow-indigo-600/20'
                : 'theme-surface text-slate-400 hover:text-slate-200 border-white/10'
            }`}
            title="Toggle display of ComfyUI Loader Node Names (e.g. Power Lora Loader)"
          >
            <Tag className="w-3.5 h-3.5 text-indigo-400" />
            <span>Node Names {showNodeTypes ? '(On)' : '(Off)'}</span>
          </button>

          <button
            onClick={handleResetAllWidths}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl theme-surface hover:bg-slate-800 text-slate-300 border border-white/10 text-xs font-bold transition-all active:scale-95 shrink-0"
            title="Reset all column width partitions to default (Excel XLS style)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Reset Columns</span>
          </button>



          <button
            onClick={onFetchMissingSizes}
            disabled={isFetchingSizes}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all active:scale-95 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetchingSizes ? 'animate-spin' : ''}`} />
            <span>{isFetchingSizes ? 'Fetching Sizes...' : 'Fetch Missing Sizes'}</span>
          </button>


          <button
            onClick={onSaveToDisk}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 shrink-0 ${
              saveSuccess 
                ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500 shadow-lg shadow-emerald-500/20'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/50 shadow-lg shadow-emerald-600/25'
            }`}
          >
            {saveSuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
            <span>{saveSuccess ? 'Saved to Disk!' : 'Save Updates'}</span>
          </button>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search filename or link..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-medium transition-all"
            />
          </div>

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-lg shadow-violet-600/30 transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Model</span>
          </button>

          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all active:scale-95 shrink-0"
            title="Search HuggingFace & CivitAI for models"
          >
            <Search className="w-4 h-4" />
            <span>Search Models</span>
          </button>
        </div>
      </div>

      {/* ── CATEGORY PILLS FILTER BAR ── */}
      <div className="category-filter-bar rounded-2xl p-2.5">
        <div className="flex w-full items-center justify-between gap-3">
          <span className="category-filter-label text-[10px] font-bold uppercase tracking-wider px-2 flex items-center gap-1">
            <Filter className="w-3 h-3 text-violet-400" /> Categories:
          </span>

          {/* View Mode Switcher: Grouped vs Flat Table */}
          <div className="category-view-switcher flex items-center gap-1 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode('grouped')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'grouped'
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Group models by folder category"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Category View</span>
            </button>

            <button
              onClick={() => setViewMode('flat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'flat'
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="View as single flat table"
            >
              <List className="w-3.5 h-3.5" />
              <span>Flat Table</span>
            </button>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-1.5">
          {/* All Pill */}
          <button
            onClick={() => setSelectedFolderTab('all')}
            className={`category-filter-chip px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedFolderTab === 'all'
                ? 'category-filter-chip-active'
                : ''
            }`}
          >
            <span>All Categories</span>
            <span className="category-filter-count px-1.5 py-0.5 rounded-md text-[10px]">
              {modelsList.length}
            </span>
          </button>

          {/* Individual Category Pills */}
          {Object.entries(folderStats.stats).map(([folderKey, data]) => {
            const isSelected = selectedFolderTab === folderKey;

            return (
              <button
                key={folderKey}
                onClick={() => setSelectedFolderTab(isSelected ? 'all' : folderKey)}
                title={`Filter models in models/${folderKey}`}
                aria-label={`Filter models in models/${folderKey}`}
                className={`category-filter-chip px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'category-filter-chip-active'
                    : ''
                }`}
              >
                <span>{folderKey}</span>
                <span className="category-filter-count px-1.5 py-0.5 rounded-md text-[10px] font-mono">
                  {data.count} ({formatMB(data.totalMB)})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── VIEW MODE 1: GROUPED BY CATEGORY ── */}
      {viewMode === 'grouped' ? (
        <div className="space-y-6">
          {groupedModels.map(group => {
            const isCollapsed = collapsedGroups[group.folder];
            const badgeStyle = getCategoryBadgeColor(group.folder);

            return (
              <div
                key={group.folder}
                className="rounded-2xl border border-white/10 bg-slate-950/60 overflow-hidden shadow-xl"
              >
                {/* Category Group Header Banner */}
                <div
                  onClick={() => toggleGroupCollapse(group.folder)}
                  className={`px-5 py-4 flex items-center justify-between cursor-pointer select-none border-b transition-colors ${
                    isCollapsed ? 'border-transparent bg-slate-900/60' : 'border-white/10 bg-slate-900/90'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button className="text-slate-400 hover:text-white">
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <span className={`px-3 py-1 rounded-xl text-xs font-extrabold border uppercase tracking-wider ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                      models/{group.folder}
                    </span>

                    <span className="text-xs text-slate-400 font-medium">
                      ({group.models.length} {group.models.length === 1 ? 'model' : 'models'})
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-xs font-mono font-extrabold text-cyan-300 bg-slate-900 px-3 py-1 rounded-xl border border-white/5">
                      <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                      {formatMB(group.totalMB)}
                    </span>
                  </div>
                </div>

                {/* Category Table Body */}
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 bg-slate-900/40 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          {renderHeaderTh('Model File / Name', 'name', 'left')}
                          {renderHeaderTh('Estimated Size', 'size', 'left')}
                          {renderHeaderTh('ComfyUI Target Directory', 'folder', 'left')}
                          {renderHeaderTh('Download Source Link', 'url', 'left')}
                          {renderHeaderTh('Actions', 'actions', 'center')}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {group.models.map(model => renderTableRow(model))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {groupedModels.length === 0 && (
            <div className="py-16 text-center text-slate-400 text-xs glass-panel rounded-2xl border border-white/10">
              No models found matching your search query or folder filter.
            </div>
          )}
        </div>
      ) : (

        /* ── VIEW MODE 2: FLAT TABLE ── */
        <div className="overflow-x-auto rounded-2xl border border-white/15 bg-slate-950/70 shadow-inner w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-slate-900/90 text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                {renderHeaderTh('Model File / Name', 'name', 'left')}
                {renderHeaderTh('Estimated Size', 'size', 'left')}
                {renderHeaderTh('ComfyUI Target Directory', 'folder', 'left')}
                {renderHeaderTh('Download Source Link', 'url', 'left')}
                {renderHeaderTh('Actions', 'actions', 'center')}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredModels.map(model => renderTableRow(model))}

              {filteredModels.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400 text-xs">
                    No models found in this filter category. Select a workflow above or click "Add Model".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

    </section>
  );

});
