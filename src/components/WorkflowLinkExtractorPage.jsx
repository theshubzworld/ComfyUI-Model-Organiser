import React, { useState, useRef } from 'react';
import { FileJson, Upload, Copy, Check, Save, Link, Sparkles, AlertCircle, Search, Filter } from 'lucide-react';
import { extractLinksFromWorkflowJson } from '../services/workflowParser';
import { COMFYUI_MODEL_FOLDERS } from '../data/comfyuiFolders';

export function WorkflowLinkExtractorPage({ onBulkAddModels }) {
  const [fileName, setFileName] = useState('');
  const [extractedItems, setExtractedItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState('all');
  const [isCopied, setIsCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonObj = JSON.parse(event.target.result);
        const links = extractLinksFromWorkflowJson(jsonObj);
        setExtractedItems(links);
      } catch (err) {
        setError(`Failed to parse workflow JSON: ${err.message}`);
        setExtractedItems([]);
      }
    };
    reader.readAsText(file);
  };

  const handleCopyLinks = () => {
    const urls = extractedItems.map(item => item.url).filter(Boolean);
    if (!urls.length) return;
    navigator.clipboard.writeText(urls.join('\n'));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleSaveToCatalog = () => {
    if (!extractedItems.length) return;
    const newModels = extractedItems.map(item => ({
      id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: item.name,
      url: item.url || '',
      folder: item.folder || 'checkpoints',
      size: item.size || 'Unknown',
      isPublic: false
    }));

    onBulkAddModels(newModels);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleUpdateItemFolder = (id, newFolder) => {
    setExtractedItems(prev => prev.map(m => m.id === id ? { ...m, folder: newFolder } : m));
  };

  const handleUpdateItemName = (id, newName) => {
    setExtractedItems(prev => prev.map(m => m.id === id ? { ...m, name: newName } : m));
  };

  const urlCount = extractedItems.filter(i => i.url).length;
  const hfCount = extractedItems.filter(i => i.url && i.url.includes('huggingface.co')).length;
  const civitaiCount = extractedItems.filter(i => i.url && i.url.includes('civitai')).length;

  const filteredItems = extractedItems.filter(item => {
    const matchesSearch = (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.url || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.nodeType || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder = folderFilter === 'all' || item.folder === folderFilter;
    return matchesSearch && matchesFolder;
  });

  return (
    <div className="w-full space-y-6 animate-fadeIn pb-12">
      
      {/* Top Banner & File Upload Section */}
      <div className="sv-card rounded-3xl p-6 md:p-8 border border-white/10 shadow-2xl relative overflow-hidden bg-gradient-to-br from-slate-900/90 via-slate-950 to-cyan-950/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold">
              <FileJson className="w-4 h-4" />
              <span>Workflow JSON Link Extractor Page</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Workflow Model & Link Analyzer
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              Upload any ComfyUI `.json` workflow file to extract all embedded model download links, HuggingFace URLs, CivitAI endpoints, and loader nodes automatically.
            </p>
          </div>

          {/* Big Interactive Upload Box */}
          <div className="w-full md:w-96 shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-cyan-500/40 hover:border-cyan-400 bg-cyan-500/5 hover:bg-cyan-500/15 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group shadow-lg"
            >
              <Upload className="w-8 h-8 text-cyan-400 group-hover:scale-110 transition-transform mb-1" />
              <span className="text-sm font-extrabold text-white">
                {fileName ? `Loaded: ${fileName}` : 'Click or Drag & Drop ComfyUI (.json)'}
              </span>
              <span className="text-[11px] text-slate-400">
                Scans HuggingFace, CivitAI & ComfyUI Loader Nodes
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Results Workspace View */}
      {extractedItems.length > 0 && (
        <div className="space-y-4">
          
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="sv-card p-4 rounded-2xl border border-white/10 bg-slate-900/60">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Model Nodes</div>
              <div className="text-2xl font-black font-mono text-white mt-1">{extractedItems.length}</div>
            </div>
            <div className="sv-card p-4 rounded-2xl border border-cyan-500/30 bg-cyan-950/20">
              <div className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">Direct Download Links</div>
              <div className="text-2xl font-black font-mono text-cyan-400 mt-1">{urlCount}</div>
            </div>
            <div className="sv-card p-4 rounded-2xl border border-violet-500/30 bg-violet-950/20">
              <div className="text-[11px] font-bold text-violet-300 uppercase tracking-wider">HuggingFace Links</div>
              <div className="text-2xl font-black font-mono text-violet-400 mt-1">{hfCount}</div>
            </div>
            <div className="sv-card p-4 rounded-2xl border border-amber-500/30 bg-amber-950/20">
              <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">CivitAI Links</div>
              <div className="text-2xl font-black font-mono text-amber-400 mt-1">{civitaiCount}</div>
            </div>
          </div>

          {/* Action Header & Search Bar */}
          <div className="sv-card p-4 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-4 bg-slate-900/80">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter extracted models by filename, URL, or node type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={folderFilter}
                  onChange={(e) => setFolderFilter(e.target.value)}
                  className="bg-slate-950 text-xs text-slate-300 border border-white/15 rounded-xl px-3 py-2 outline-none font-bold"
                >
                  <option value="all">All ComfyUI Folders</option>
                  {COMFYUI_MODEL_FOLDERS.map(f => (
                    <option key={f} value={f}>models/{f}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {urlCount > 0 && (
                <button
                  onClick={handleCopyLinks}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 text-xs font-extrabold transition-all shadow-md"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
                  <span>{isCopied ? 'All Links Copied!' : 'Copy All Links'}</span>
                </button>
              )}
              <button
                onClick={handleSaveToCatalog}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-extrabold transition-all shadow-lg shadow-violet-600/30"
              >
                {isSaved ? <Check className="w-4 h-4 text-white" /> : <Save className="w-4 h-4" />}
                <span>{isSaved ? 'Saved to Catalog!' : 'Save All to Catalog'}</span>
              </button>
            </div>
          </div>

          {/* Full Page Extracted Models Table */}
          <div className="sv-card rounded-3xl border border-white/10 overflow-hidden bg-slate-950/80 shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 font-bold bg-slate-900/90">
                    <th className="p-4 w-[240px]">Model Filename</th>
                    <th className="p-4 w-[180px]">Target ComfyUI Folder</th>
                    <th className="p-4 w-[220px]">Node Type Signature</th>
                    <th className="p-4">Direct Download URL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white w-[240px] truncate" title={item.name}>
                        <input
                          type="text"
                          value={item.name}
                          title={item.name}
                          onChange={(e) => handleUpdateItemName(item.id, e.target.value)}
                          className="bg-transparent border-b border-transparent focus:border-cyan-400 outline-none w-full text-white text-xs font-bold py-1 truncate"
                        />
                      </td>
                      <td className="p-4 w-[180px]">
                        <select
                          value={item.folder}
                          onChange={(e) => handleUpdateItemFolder(item.id, e.target.value)}
                          className="bg-slate-900 text-cyan-300 border border-white/15 rounded-xl px-3 py-1.5 text-xs font-bold w-full"
                        >
                          {COMFYUI_MODEL_FOLDERS.map(f => (
                            <option key={f} value={f}>models/{f}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 w-[220px]">
                        <span className="text-[11px] bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg border border-white/10 font-bold inline-block max-w-full truncate" title={item.nodeType}>
                          {item.nodeType}
                        </span>
                      </td>
                      <td className="p-4 truncate">
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-400 hover:underline flex items-center gap-2 truncate font-semibold"
                            title={item.url}
                          >
                            <Link className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{item.url}</span>
                          </a>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">No URL in JSON</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-slate-500 text-xs italic">
                        No model nodes match your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Empty State when no file is loaded */}
      {extractedItems.length === 0 && !error && (
        <div className="sv-card p-16 rounded-3xl border border-white/10 text-center space-y-4 bg-slate-900/40">
          <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto shadow-inner">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-white">No Workflow JSON Loaded Yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Click the upload box above or drag & drop any `.json` ComfyUI workflow to instantly extract all loader model filenames and download links into a clean table.
          </p>
        </div>
      )}

    </div>
  );
}
