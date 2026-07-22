import React, { useState, useRef } from 'react';
import { Sparkles, Upload, CheckSquare, Square, Search, X, Check, Layers, FileJson } from 'lucide-react';
import { parseComfyUIWorkflow, parseTextDownloadList } from '../services/workflowParser';

export function WorkflowSelector({ 
  workflowsList, 
  selectedWorkflowIds, 
  onToggleWorkflow, 
  onSelectAllWorkflows, 
  onClearWorkflowSelection,
  onCustomWorkflowUploaded,
  onOpenLinkExtractor,
  catalog
}) {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef(null);

  const categories = ['ALL', '0-IMAGE', '1-AUDIO', '2-VIDEO', '3-FACESWAP', 'CUSTOM', 'XXX-NSFW-VIDEO'];

  const filteredWorkflows = workflowsList.filter(wf => {
    const matchesCategory = activeCategory === 'ALL' || wf.category === activeCategory;
    const matchesSearch = wf.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          wf.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleFileUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target.result;
          if (file.name.endsWith('.json')) {
            const parsedJson = JSON.parse(content);
            const extractedModels = parseComfyUIWorkflow(parsedJson, catalog);
            
            const customWf = {
              id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
              name: file.name.replace('.json', ''),
              category: 'CUSTOM',
              file: file.name,
              models: extractedModels
            };
            onCustomWorkflowUploaded(customWf);
          } else if (file.name.endsWith('.txt')) {
            const extractedModels = parseTextDownloadList(content, catalog);
            const customWf = {
              id: 'custom_txt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
              name: file.name.replace('.txt', ''),
              category: 'CUSTOM',
              file: file.name,
              models: extractedModels
            };
            onCustomWorkflowUploaded(customWf);
          }
        } catch (err) {
          alert(`Error reading file ${file.name}: ${err.message}`);
        }
      };
      reader.readAsText(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <section className="glass-panel rounded-2xl p-4 lg:p-5 shadow-xl border border-white/10 lg:h-full lg:flex lg:flex-col">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              Select Workflows ({selectedWorkflowIds.length} / {workflowsList.length} Active)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Choose your ComfyUI workflows or upload new `.json` files to parse their required models
            </p>
          </div>
        </div>

        {/* Global Controls & Upload */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".json,.txt"
            multiple
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Workflow JSON</span>
          </button>

          {onOpenLinkExtractor && (
            <button
              onClick={onOpenLinkExtractor}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition-all shadow-md active:scale-95"
              title="Extract all model download links from any ComfyUI workflow JSON"
            >
              <FileJson className="w-4 h-4 text-indigo-400" />
              <span>Extract Links from JSON</span>
            </button>
          )}

          <button
            onClick={onSelectAllWorkflows}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 text-xs font-bold transition-all"
          >
            Select All
          </button>

          <button
            onClick={onClearWorkflowSelection}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 text-xs font-bold transition-all"
          >
            Clear Selection
          </button>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        
        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === cat 
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30 scale-105' 
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search workflow name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-900/90 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-medium transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>

      {/* Workflow Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 max-h-[22rem] overflow-y-auto pr-1 lg:flex-1 lg:min-h-0 lg:max-h-none lg:content-start">
        {filteredWorkflows.map(wf => {
          const isSelected = selectedWorkflowIds.includes(wf.id);
          const modelCount = wf.models?.length || 0;

          return (
            <div
              key={wf.id}
              onClick={() => onToggleWorkflow(wf.id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-start justify-between gap-2 ${
                isSelected 
                  ? 'bg-gradient-to-br from-violet-900/40 to-indigo-900/30 border-violet-500 shadow-xl shadow-violet-600/15 ring-1 ring-violet-500/50' 
                  : 'bg-slate-900/50 border-white/10 hover:bg-slate-800/80 hover:border-white/20'
              }`}
            >
              <div className="flex items-start gap-2 min-w-0">
                <div className="mt-0.5 shrink-0">
                  {isSelected ? (
                    <div className="w-4 h-4 rounded bg-violet-600 text-white flex items-center justify-center shadow-md">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded border border-white/20 bg-slate-800" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                    {wf.name}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-white/10 font-mono font-semibold">
                      {wf.category}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono font-semibold">
                      {modelCount} {modelCount === 1 ? 'model' : 'models'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredWorkflows.length === 0 && (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">
            No workflows found matching "{searchQuery}"
          </div>
        )}
      </div>

    </section>
  );
}
