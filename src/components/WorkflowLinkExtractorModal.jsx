import React, { useState, useRef } from 'react';
import { FileJson, Upload, Copy, Check, Save, X, Link, HardDrive, AlertCircle, Sparkles } from 'lucide-react';
import { extractLinksFromWorkflowJson } from '../services/workflowParser';
import { COMFYUI_MODEL_FOLDERS } from '../data/comfyuiFolders';

export function WorkflowLinkExtractorModal({ isOpen, onClose, onBulkAddModels }) {
  const [fileName, setFileName] = useState('');
  const [extractedItems, setExtractedItems] = useState([]);
  const [isCopied, setIsCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

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
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1500);
  };

  const handleUpdateItemFolder = (id, newFolder) => {
    setExtractedItems(prev => prev.map(m => m.id === id ? { ...m, folder: newFolder } : m));
  };

  const handleUpdateItemName = (id, newName) => {
    setExtractedItems(prev => prev.map(m => m.id === id ? { ...m, name: newName } : m));
  };

  const noUrlCount = extractedItems.length - urlCount;

  const handleRemoveMissingUrls = () => {
    setExtractedItems(prev => prev.filter(item => Boolean(item.url)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="sv-card relative w-[96vw] max-w-7xl h-[92vh] max-h-[95vh] rounded-3xl p-6 md:p-8 shadow-2xl border border-white/10 flex flex-col space-y-5 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
              <FileJson className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                Extract Links from Workflow JSON
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload any ComfyUI `.json` workflow to automatically extract all model URLs & loader nodes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload Zone */}
        <div className="shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-cyan-500/30 hover:border-cyan-500/60 bg-cyan-500/5 hover:bg-cyan-500/10 rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
          >
            <Upload className="w-7 h-7 text-cyan-400 mb-0.5" />
            <span className="text-sm font-bold text-white">
              {fileName ? `File Selected: ${fileName}` : 'Click or Drag & Drop ComfyUI Workflow (.json) File'}
            </span>
            <span className="text-xs text-slate-400">
              Scans HuggingFace Downloader nodes, CivitAI nodes, Loader nodes, & widget URL strings
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Extracted Items Results Table */}
        {extractedItems.length > 0 && (
          <div className="flex-1 min-h-0 flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 shrink-0">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Found {extractedItems.length} Model Nodes ({urlCount} Direct Download Links)
              </span>
              <div className="flex items-center gap-2">
                {noUrlCount > 0 && (
                  <button
                    onClick={handleRemoveMissingUrls}
                    title="Remove all filenames with missing download links"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all"
                  >
                    <span>🗑️ Remove No-URL Items ({noUrlCount})</span>
                  </button>
                )}
                {urlCount > 0 && (
                  <button
                    onClick={handleCopyLinks}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 text-xs font-bold transition-all"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                    <span>{isCopied ? 'Links Copied!' : 'Copy Links'}</span>
                  </button>
                )}
                <button
                  onClick={handleSaveToCatalog}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-md"
                >
                  {isSaved ? <Check className="w-3.5 h-3.5 text-white" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{isSaved ? 'Saved to Catalog!' : 'Save All to Catalog'}</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/10 rounded-2xl bg-slate-950/60 p-3">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 font-bold sticky top-0 bg-slate-950/90 backdrop-blur-md z-10">
                    <th className="p-3 w-1/4">Model Filename</th>
                    <th className="p-3 w-1/5">ComfyUI Folder</th>
                    <th className="p-3 w-1/6">Node Type</th>
                    <th className="p-3 w-2/5">Download URL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {extractedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 font-bold text-white max-w-[300px]">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateItemName(item.id, e.target.value)}
                          className="bg-transparent border-b border-transparent focus:border-cyan-400 outline-none w-full text-white text-xs py-0.5"
                        />
                      </td>
                      <td className="p-3">
                        <select
                          value={item.folder}
                          onChange={(e) => handleUpdateItemFolder(item.id, e.target.value)}
                          className="bg-slate-900 text-cyan-300 border border-white/10 rounded px-2.5 py-1 text-xs"
                        >
                          {COMFYUI_MODEL_FOLDERS.map(f => (
                            <option key={f} value={f}>models/{f}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <span className="text-[11px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md border border-white/10 inline-block">
                          {item.nodeType}
                        </span>
                      </td>
                      <td className="p-3 max-w-[550px] truncate">
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-400 hover:underline flex items-center gap-1.5 truncate"
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
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
