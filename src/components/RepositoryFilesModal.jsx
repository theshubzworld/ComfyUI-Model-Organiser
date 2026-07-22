import React, { useState, useEffect } from 'react';
import { Folder, File, Link, Copy, Check, Plus, X, HardDrive, RefreshCw, Sparkles, FolderTree } from 'lucide-react';
import { normalizeModelFolder, guessFolderFromFilename } from '../data/comfyuiFolders';

export function RepositoryFilesModal({ isOpen, onClose, model, platformTab, onAddModelItem }) {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [copiedUrl, setCopiedUrl] = useState(null);
  const [addedFiles, setAddedFiles] = useState(new Set());
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !model) return;

    setError(null);
    setFiles([]);
    setLoading(true);

    if (platformTab === 'hf' || model.repoId || (model.id && typeof model.id === 'string' && model.id.includes('/'))) {
      const repoId = model.repoId || model.id || model.name;
      // Query HuggingFace Tree API
      fetch(`https://huggingface.co/api/models/${repoId}/tree/main?recursive=true`)
        .then(res => {
          if (!res.ok) throw new Error(`HuggingFace API HTTP ${res.status}`);
          return res.json();
        })
        .then(treeData => {
          const modelFiles = (Array.isArray(treeData) ? treeData : [])
            .filter(item => item.type === 'file' && /\.(safetensors|ckpt|pth|gguf|bin|pt|onnx|sft)$/i.test(item.path))
            .map(item => {
              const fileName = item.path.split('/').pop();
              const folder = guessFolderFromFilename(fileName, item.path);
              const downloadUrl = `https://huggingface.co/${repoId}/resolve/main/${item.path}`;
              const sizeMB = item.size ? (item.size / (1024 * 1024)).toFixed(0) + ' MB' : 'Unknown';
              return {
                id: item.path,
                path: item.path,
                fileName: fileName,
                size: sizeMB,
                folder: folder,
                downloadUrl: downloadUrl,
                repoId: repoId
              };
            });

          setFiles(modelFiles);
          setLoading(false);
        })
        .catch(err => {
          console.warn('[RepositoryFilesModal] Error fetching HF tree:', err);
          setError(`Could not fetch subfolder tree: ${err.message}`);
          setLoading(false);
        });
    } else if (platformTab === 'civitai' && model.modelVersions) {
      // CivitAI Model Versions & Files
      const allFiles = [];
      model.modelVersions.forEach(ver => {
        (ver.files || []).forEach(f => {
          const folder = guessFolderFromFilename(f.name, model.type);
          allFiles.push({
            id: f.id || f.name,
            path: `${ver.name} / ${f.name}`,
            fileName: f.name,
            size: f.sizeKB ? (f.sizeKB / 1024).toFixed(0) + ' MB' : 'Unknown',
            folder: folder,
            downloadUrl: f.downloadUrl || `https://civitai.com/api/download/models/${ver.id}`,
            versionName: ver.name
          });
        });
      });
      setFiles(allFiles);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [isOpen, model, platformTab]);

  if (!isOpen || !model) return null;

  const handleCopyLink = (url, id) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(id);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleAddSingleFile = (file) => {
    const item = {
      id: file.fileName,
      name: file.fileName,
      url: file.downloadUrl,
      folder: file.folder,
      size: file.size,
      catalogOrigin: 'master'
    };
    onAddModelItem(model, { name: file.versionName || model.name }, { name: file.fileName, size: file.size, downloadUrl: file.downloadUrl });
    setAddedFiles(prev => new Set(prev).add(file.id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="sv-card relative w-[95vw] max-w-5xl h-[85vh] max-h-[90vh] rounded-3xl p-6 md:p-8 shadow-2xl border border-white/10 flex flex-col space-y-5 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-violet-600/20 border border-violet-500/30 text-violet-400">
              <FolderTree className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                Subfolders & File Tree: <span className="text-cyan-400 font-mono">{model.name}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect all model files, LoRAs, VAEs, and Text Encoders inside this repository directory
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

        {/* Loading State */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            <span className="text-xs font-bold text-slate-300">Fetching subfolders and files from repository...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Files Table */}
        {!loading && files.length > 0 && (
          <div className="flex-1 min-h-0 flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 shrink-0">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Found {files.length} AI Model Files in Repository Subfolders
              </span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/10 rounded-2xl bg-slate-950/70 p-3">
              <table className="w-full text-left text-xs text-slate-300 border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 font-bold sticky top-0 bg-slate-950/90 backdrop-blur-md z-10">
                    <th className="p-3 w-2/5">Subfolder File Path</th>
                    <th className="p-3 w-1/5">Target Folder</th>
                    <th className="p-3 w-1/6">Est. Size</th>
                    <th className="p-3 w-1/4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {files.map(file => {
                    const isAdded = addedFiles.has(file.id);

                    return (
                      <tr key={file.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 font-bold text-white truncate" title={file.path}>
                          <div className="flex items-center gap-2 truncate">
                            <File className="w-4 h-4 text-cyan-400 shrink-0" />
                            <span className="truncate">{file.path}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-[11px] bg-slate-900 text-cyan-300 border border-white/10 rounded-lg px-2.5 py-1 font-bold inline-block">
                            models/{file.folder}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-emerald-400">
                          {file.size}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleCopyLink(file.downloadUrl, file.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 transition-all text-xs flex items-center gap-1 font-bold"
                              title="Copy Direct Download Link"
                            >
                              {copiedUrl === file.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                              <span>{copiedUrl === file.id ? 'Copied' : 'Copy Link'}</span>
                            </button>

                            <button
                              onClick={() => handleAddSingleFile(file)}
                              disabled={isAdded}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                isAdded
                                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-violet-600 hover:bg-violet-500 text-white shadow-md'
                              }`}
                            >
                              {isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                              <span>{isAdded ? 'Added' : 'Add to List'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && files.length === 0 && !error && (
          <div className="py-16 text-center text-slate-500 text-xs italic">
            No subfolder files found for this repository.
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
          >
            Close Drawer
          </button>
        </div>

      </div>
    </div>
  );
}
