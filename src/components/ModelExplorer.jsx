import React, { useState, useEffect } from 'react';
import {
  Search, Filter, RefreshCw, ExternalLink, Plus, Check, Copy,
  Star, Download, ThumbsUp, Layers, HardDrive, AlertCircle, Sparkles,
  ChevronLeft, ChevronRight, X, User, Tag, Image as ImageIcon, SlidersHorizontal,
  Flame, Calendar, Shield, Cpu
} from 'lucide-react';
import { loadTokens } from './TokenSettingsModal';

const MODEL_TYPES = [
  'All',
  'Checkpoint',
  'LORA',
  'LoCon',
  'DoRA',
  'Controlnet',
  'Upscaler',
  'MotionModule',
  'VAE',
  'TextEncoder',
  'UNet',
  'CLIPVision',
  'Poses',
  'Wildcards',
  'Workflows',
  'Detection',
  'VisionLanguage',
  'CLIP',
  'LLM',
  'TextualInversion',
  'Hypernetwork',
  'AestheticGradient',
  'Other',
];

const BASE_MODELS = [
  'All',
  'Wan Video 2.2 T2V-A14B',
  'Wan Video 2.2 I2V-A14B',
  'Wan Video 2.2 TI2V-5B',
  'Wan Video 14B t2v',
  'Wan Video 14B i2v 720p',
  'Wan Video 14B i2v 480p',
  'Wan Video 1.3B t2v',
  'Wan Video 2.5 T2V',
  'Wan Video 2.5 I2V',
  'Wan Video 2.7',
  'Wan Image 2.7',
  'Wan Video',
  'Flux.1 D',
  'Flux.1 S',
  'Flux.1 Krea',
  'Flux.1 Kontext',
  'Flux.2 D',
  'Flux.2 Klein 9B',
  'Flux.2 Klein 4B',
  'Pony',
  'Pony V7',
  'Illustrious',
  'NoobAI',
  'Hunyuan Video',
  'Hunyuan 1',
  'Hunyuan3D',
  'SDXL 1.0',
  'SDXL Lightning',
  'SDXL Hyper',
  'SDXL Turbo',
  'SDXL 0.9',
  'SDXL 1.0 LCM',
  'SD 1.5',
  'SD 1.5 LCM',
  'SD 1.5 Hyper',
  'SD 1.4',
  'SD 2.1',
  'SD 2.1 768',
  'SD 2.0',
  'SD 2.0 768',
  'SD 3.5',
  'SD 3.5 Large',
  'SD 3.5 Medium',
  'SD 3.5 Large Turbo',
  'SD 3',
  'Stable Cascade',
  'SVD',
  'SVD XT',
  'LTXV',
  'LTXV2',
  'LTXV 2.3',
  'CogVideoX',
  'Mochi',
  'Lumina',
  'Kolors',
  'PixArt a',
  'PixArt E',
  'Playground v2',
  'AuraFlow',
  'Anima',
  'Chroma',
  'Ernie',
  'Grok',
  'HiDream',
  'HiDream-O1',
  'Krea 2',
  'Qwen 2',
  'ZImageTurbo',
  'ZImageBase',
  'Imagen4',
  'Nano Banana',
  'Sora 2',
  'Veo 3',
  'Hailuo by MiniMax',
  'Kling',
  'Seedance',
  'ACE Audio',
  'Other',
];

const CHECKPOINT_TYPES = [
  'All',
  'Trained',
  'Merge',
];

const SORT_OPTIONS = [
  { id: 'Most Downloaded', label: 'Most Downloaded' },
  { id: 'Highest Rated',   label: 'Highest Rated' },
  { id: 'Newest',           label: 'Newest' },
  { id: 'Most Liked',       label: 'Most Liked' },
  { id: 'Most Discussed',   label: 'Most Discussed' },
  { id: 'Most Collected',   label: 'Most Collected' },
];

const PERIOD_OPTIONS = [
  { id: 'AllTime', label: 'All Time' },
  { id: 'Year',    label: 'Past Year' },
  { id: 'Month',   label: 'Past Month' },
  { id: 'Week',    label: 'Past Week' },
  { id: 'Day',     label: 'Past 24h' },
];

const NSFW_OPTIONS = [
  { id: 'All',  label: 'All Content' },
  { id: 'None', label: 'SFW Only' },
  { id: 'Soft', label: 'Soft NSFW' },
  { id: 'Mature', label: 'Mature NSFW' },
  { id: 'X',    label: 'Explicit NSFW' },
];

const POPULAR_TAGS = [
  'anime', 'character', 'style', 'concept', 'clothing',
  'realism', 'pose', 'base model', 'tools', 'vehicle', 'location'
];

const HF_FILTERS = ['All', 'diffusers', 'gguf', 'lora', 'text-to-image'];
const HF_SORTS = [
  { id: 'downloads', label: 'Most Downloaded' },
  { id: 'likes',     label: 'Most Liked' },
  { id: 'updated',   label: 'Recently Updated' },
];

export function ModelExplorer({ onAddModel, existingModels = [] }) {
  const [platformTab, setPlatformTab] = useState('civitai'); // 'civitai' | 'hf'

  // Dynamic Enums from CivitAI API
  const [baseModelsList, setBaseModelsList] = useState(BASE_MODELS);
  const [typesList, setTypesList] = useState(MODEL_TYPES);

  useEffect(() => {
    fetch('/api/civitai-explorer?enums=true')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const liveBms = data.BaseModel || data.ActiveBaseModel || [];
        if (liveBms.length) {
          setBaseModelsList(prev => {
            const combined = new Set(['All', ...prev.filter(x => x !== 'All'), ...liveBms]);
            return Array.from(combined);
          });
        }
        const liveTypes = data.ModelType || [];
        if (liveTypes.length) {
          setTypesList(prev => {
            const combined = new Set(['All', ...prev.filter(x => x !== 'All'), ...liveTypes]);
            return Array.from(combined);
          });
        }
      })
      .catch(() => {});
  }, []);

  // CivitAI Filter State
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedBaseModel, setSelectedBaseModel] = useState('All');

  const [selectedCheckpointType, setSelectedCheckpointType] = useState('All');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedUsername, setSelectedUsername] = useState('');
  const [selectedNsfw, setSelectedNsfw] = useState('All');
  const [selectedSort, setSelectedSort] = useState('Most Downloaded');
  const [selectedPeriod, setSelectedPeriod] = useState('AllTime');
  const [page, setPage] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // HF Filter State
  const [hfQuery, setHfQuery] = useState('');
  const [hfFilter, setHfFilter] = useState('All');
  const [hfSort, setHfSort] = useState('downloads');

  // API Data State
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('idle'); // 'idle'|'loading'|'done'|'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedVersions, setSelectedVersions] = useState({}); // { [modelId]: versionIndex }
  const [addedIds, setAddedIds] = useState(new Set());
  const [copiedUrl, setCopiedUrl] = useState(null);

  // Fetch CivitAI Models
  const fetchCivitaiModels = async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const params = new URLSearchParams({
        query: query.trim(),
        types: selectedType,
        baseModels: selectedBaseModel,
        checkpointType: selectedCheckpointType,
        tag: selectedTag.trim(),
        username: selectedUsername.trim(),
        nsfw: selectedNsfw,
        sort: selectedSort,
        period: selectedPeriod,
        page: page.toString(),
        limit: '20',
      });
      const res = await fetch(`/api/civitai-explorer?${params}`);
      if (!res.ok) throw new Error(`CivitAI server error ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
      setStatus('done');
    } catch (e) {
      setErrorMsg(e.message || 'Failed to connect to backend server');
      setStatus('error');
    }
  };

  // Fetch HuggingFace Models
  const fetchHfModels = async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const params = new URLSearchParams({
        query: hfQuery.trim(),
        filter: hfFilter,
        sort: hfSort,
        limit: '20',
      });
      const res = await fetch(`/api/hf-explorer?${params}`);
      if (!res.ok) throw new Error(`HuggingFace server error ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
      setStatus('done');
    } catch (e) {
      setErrorMsg(e.message || 'Failed to connect to backend server');
      setStatus('error');
    }
  };

  // Auto-fetch when CivitAI filters change
  useEffect(() => {
    if (platformTab === 'civitai') {
      fetchCivitaiModels();
    } else {
      fetchHfModels();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    platformTab, selectedType, selectedBaseModel, selectedCheckpointType,
    selectedTag, selectedUsername, selectedNsfw, selectedSort, selectedPeriod, page,
    hfFilter, hfSort
  ]);

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    setPage(1);
    if (platformTab === 'civitai') fetchCivitaiModels();
    else fetchHfModels();
  };

  const handleResetFilters = () => {
    setQuery('');
    setSelectedType('All');
    setSelectedBaseModel('All');
    setSelectedCheckpointType('All');
    setSelectedTag('');
    setSelectedUsername('');
    setSelectedNsfw('All');
    setSelectedSort('Most Downloaded');
    setSelectedPeriod('AllTime');
    setPage(1);
    setHfQuery('');
    setHfFilter('All');
    setHfSort('downloads');
  };

  const activeCivitaiFiltersCount = [
    query.trim(),
    selectedType !== 'All' ? selectedType : '',
    selectedBaseModel !== 'All' ? selectedBaseModel : '',
    selectedCheckpointType !== 'All' ? selectedCheckpointType : '',
    selectedTag.trim(),
    selectedUsername.trim(),
    selectedNsfw !== 'All' ? selectedNsfw : '',
    selectedSort !== 'Most Downloaded' ? selectedSort : '',
    selectedPeriod !== 'AllTime' ? selectedPeriod : '',
  ].filter(Boolean).length;

  const handleAddModelItem = (model, versionObj, fileObj) => {
    const { civitaiToken } = loadTokens();
    let downloadUrl = fileObj?.downloadUrl || versionObj?.downloadUrl || model.url;
    if (platformTab === 'civitai' && civitaiToken && !downloadUrl.includes('token=')) {
      downloadUrl += `&token=${civitaiToken}`;
    }

    const folderMap = {
      'lora': 'loras', 'locon': 'loras',
      'checkpoint': 'checkpoints',
      'textualinversion': 'embeddings',
      'vae': 'vae', 'controlnet': 'controlnet',
      'upscaler': 'upscale_models',
    };
    const folder = folderMap[model.type?.toLowerCase()] || 'checkpoints';
    const filename = fileObj?.name || `${model.name}.safetensors`;

    const newModel = {
      id: 'm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: filename,
      folder: folder,
      url: downloadUrl,
      size: fileObj?.size || 'Unknown',
      source: `Explorer (${platformTab === 'civitai' ? 'CivitAI' : 'HF'})`,
    };

    onAddModel(newModel);
    setAddedIds(prev => new Set(prev).add(model.id || filename));
  };

  const handleCopyUrl = (url, id) => {
    navigator.clipboard?.writeText(url);
    setCopiedUrl(id);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col space-y-6 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-4 relative">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/30 text-white">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2 tracking-tight">
              AI Model Explorer
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Browse & search millions of CivitAI and HuggingFace models with native platform filters
            </p>
          </div>
        </div>

        {/* Platform Switcher */}
        <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-2xl border border-white/15 shrink-0 self-start md:self-auto">
          <button
            onClick={() => setPlatformTab('civitai')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              platformTab === 'civitai'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span>CivitAI Explorer</span>
          </button>

          <button
            onClick={() => setPlatformTab('hf')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              platformTab === 'hf'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>HuggingFace Explorer</span>
          </button>
        </div>
      </div>

      {/* ── CIVITAI FILTERS SECTION ── */}
      {platformTab === 'civitai' ? (
        <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-4 shadow-xl">
          {/* Top Search Bar & Main Filter Controls */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search CivitAI models, LoRAs, characters, styles..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-950/80 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium transition-all"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={status === 'loading'}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/25 shrink-0"
            >
              {status === 'loading' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Search</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all shrink-0 border ${
                showAdvanced || activeCivitaiFiltersCount > 0
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/10'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeCivitaiFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {activeCivitaiFiltersCount}
                </span>
              )}
            </button>
            {activeCivitaiFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all shrink-0"
              >
                Reset All
              </button>
            )}
          </form>

          {/* Primary Filter Selectors Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-white/5">
            {/* Model Type */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Layers className="w-3 h-3 text-blue-400" /> Model Type
              </label>
              <select
                value={selectedType}
                onChange={e => { setSelectedType(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white outline-none focus:border-blue-500 font-semibold"
              >
                {typesList.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Base Model */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Cpu className="w-3 h-3 text-violet-400" /> Base Architecture
              </label>
              <select
                value={selectedBaseModel}
                onChange={e => { setSelectedBaseModel(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white outline-none focus:border-blue-500 font-semibold"
              >
                {baseModelsList.map(b => <option key={b} value={b}>{b}</option>)}
              </select>

            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-400" /> Sort By
              </label>
              <select
                value={selectedSort}
                onChange={e => { setSelectedSort(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white outline-none focus:border-blue-500 font-semibold"
              >
                {SORT_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>

            {/* Period */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-emerald-400" /> Time Period
              </label>
              <select
                value={selectedPeriod}
                onChange={e => { setSelectedPeriod(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white outline-none focus:border-blue-500 font-semibold"
              >
                {PERIOD_OPTIONS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Advanced Filters Drawer (Checkpoint SubType, Specific Tag, Creator Username, NSFW) */}
          {(showAdvanced || activeCivitaiFiltersCount > 2) && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-white/10">
              {/* Checkpoint Sub-Type */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Checkpoint Source
                </label>
                <select
                  value={selectedCheckpointType}
                  onChange={e => { setSelectedCheckpointType(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white outline-none focus:border-blue-500 font-semibold"
                >
                  {CHECKPOINT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Tag Search */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-cyan-400" /> Category Tag
                </label>
                <input
                  type="text"
                  value={selectedTag}
                  onChange={e => { setSelectedTag(e.target.value); setPage(1); }}
                  placeholder="e.g. anime, character..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white outline-none focus:border-blue-500 font-medium"
                />
              </div>

              {/* Creator Username */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <User className="w-3 h-3 text-pink-400" /> Creator Username
                </label>
                <input
                  type="text"
                  value={selectedUsername}
                  onChange={e => { setSelectedUsername(e.target.value); setPage(1); }}
                  placeholder="e.g. Monobot..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white outline-none focus:border-blue-500 font-medium"
                />
              </div>

              {/* NSFW Content Rating */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-rose-400" /> Safety Filter
                </label>
                <select
                  value={selectedNsfw}
                  onChange={e => { setSelectedNsfw(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white outline-none focus:border-blue-500 font-semibold"
                >
                  {NSFW_OPTIONS.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Quick Tag Badges Row */}
          <div className="flex items-center gap-1.5 flex-wrap pt-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Popular Tags:</span>
            {POPULAR_TAGS.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setSelectedTag(selectedTag === t ? '' : t); setPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  selectedTag === t
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-white/5'
                }`}
              >
                #{t}
              </button>
            ))}
          </div>
        </div>
      ) : (

        /* ── HUGGINGFACE FILTERS SECTION ── */
        <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-4 shadow-xl">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={hfQuery}
                onChange={e => setHfQuery(e.target.value)}
                placeholder="Search HuggingFace models, GGUF, diffusers, Wan2.2, Flux..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-950/80 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-medium transition-all"
              />
              {hfQuery && (
                <button type="button" onClick={() => setHfQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={status === 'loading'}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-amber-600/25 shrink-0"
            >
              {status === 'loading' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Search HF</span>
            </button>
          </form>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1 border-t border-white/5">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category Filter</label>
              <select
                value={hfFilter}
                onChange={e => setHfFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white outline-none focus:border-amber-500 font-semibold"
              >
                {HF_FILTERS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sort By</label>
              <select
                value={hfSort}
                onChange={e => setHfSort(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white outline-none focus:border-amber-500 font-semibold"
              >
                {HF_SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Status / Loading / Error Display */}
      {status === 'loading' && (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Fetching models from {platformTab === 'civitai' ? 'CivitAI' : 'HuggingFace'}...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-300">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="text-sm font-bold">Failed to load models</p>
            <p className="text-xs text-rose-400/80 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {status === 'done' && items.length === 0 && (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-3 glass-panel rounded-2xl border border-white/10">
          <Search className="w-10 h-10 text-slate-600" />
          <p className="text-slate-400 font-semibold text-sm">No models found matching your criteria</p>
          <p className="text-xs text-slate-500">Try adjusting your filters or keywords</p>
          <button onClick={handleResetFilters} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold">
            Reset All Filters
          </button>
        </div>
      )}

      {/* ── RESULTS GRID ── */}
      {status === 'done' && items.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {items.map(model => {
              const verIdx = selectedVersions[model.id] || 0;
              const versions = model.modelVersions || [];
              const activeVersion = versions[verIdx] || versions[0] || {};
              const primaryFile = (activeVersion.files || []).find(f => f.primary) || activeVersion.files?.[0];
              const previewImg = (activeVersion.images || [])[0]?.url;
              const isAdded = addedIds.has(model.id) || addedIds.has(primaryFile?.name);

              return (
                <div
                  key={model.id}
                  className="group rounded-2xl border border-white/10 bg-slate-900/60 hover:bg-slate-900/90 hover:border-white/20 transition-all flex flex-col overflow-hidden shadow-lg"
                >
                  {/* Cover Image / Thumbnail (CivitAI) */}
                  {platformTab === 'civitai' ? (
                    <div className="relative aspect-[4/3] w-full bg-slate-950 overflow-hidden shrink-0">
                      {previewImg ? (
                        <img
                          src={previewImg}
                          alt={model.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-700">
                          <ImageIcon className="w-8 h-8 mb-1 opacity-50" />
                          <span className="text-[10px]">No Preview</span>
                        </div>
                      )}

                      {/* Top Badges */}
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 pointer-events-none">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-black/70 backdrop-blur-md text-blue-300 border border-blue-500/40 uppercase tracking-wider">
                          {model.type}
                        </span>
                        {activeVersion.baseModel && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-violet-600/80 backdrop-blur-md text-white border border-violet-400/30">
                            {activeVersion.baseModel}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* HuggingFace Card Header */
                    <div className="p-4 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-white/5 flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {model.type}
                      </span>
                      <span className="text-xs text-slate-400 font-mono truncate">{model.author}</span>
                    </div>
                  )}

                  {/* Card Content Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      {/* Model Title */}
                      <h3 className="text-sm font-bold text-white line-clamp-2 leading-snug group-hover:text-blue-300 transition-colors">
                        {model.name}
                      </h3>

                      {/* Creator info */}
                      {model.creator?.username && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                          <User className="w-3 h-3 text-slate-500" />
                          <span className="truncate">{model.creator.username}</span>
                        </div>
                      )}

                      {/* Stats Row */}
                      {platformTab === 'civitai' ? (
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2 flex-wrap">
                          {model.stats?.rating > 0 && (
                            <span className="flex items-center gap-1 text-amber-400 font-semibold">
                              <Star className="w-3 h-3 fill-amber-400" />
                              {model.stats.rating.toFixed(1)}
                            </span>
                          )}
                          {model.stats?.downloadCount > 0 && (
                            <span className="flex items-center gap-1 text-slate-400">
                              <Download className="w-3 h-3" />
                              {(model.stats.downloadCount).toLocaleString()}
                            </span>
                          )}
                          {model.stats?.thumbsUpCount > 0 && (
                            <span className="flex items-center gap-1 text-blue-400">
                              <ThumbsUp className="w-3 h-3" />
                              {(model.stats.thumbsUpCount).toLocaleString()}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2">
                          <span className="flex items-center gap-1 text-slate-400">
                            <Download className="w-3 h-3" />
                            {model.downloads.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1 text-amber-400">
                            ★ {model.likes.toLocaleString()}
                          </span>
                        </div>
                      )}

                      {/* Version Picker (if CivitAI and multiple versions exist) */}
                      {platformTab === 'civitai' && versions.length > 1 && (
                        <div className="mt-3">
                          <select
                            value={verIdx}
                            onChange={e => setSelectedVersions(prev => ({ ...prev, [model.id]: Number(e.target.value) }))}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/10 text-[11px] text-slate-200 outline-none font-medium"
                          >
                            {versions.map((v, idx) => (
                              <option key={v.id} value={idx}>
                                {v.name} ({v.baseModel})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Primary File Details */}
                      {primaryFile && (
                        <div className="mt-2.5 p-2 rounded-xl bg-slate-950/70 border border-white/5 space-y-1">
                          <div className="text-[11px] font-mono text-slate-300 truncate" title={primaryFile.name}>
                            {primaryFile.name}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                              <HardDrive className="w-3 h-3" /> {primaryFile.size}
                            </span>
                            {activeVersion.name && <span className="text-slate-400">{activeVersion.name}</span>}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Actions Footer */}
                    <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                      <button
                        onClick={() => handleAddModelItem(model, activeVersion, primaryFile)}
                        disabled={isAdded}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                          isAdded
                            ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25'
                        }`}
                      >
                        {isAdded ? <><Check className="w-3.5 h-3.5" /> Added</> : <><Plus className="w-3.5 h-3.5" /> Add to List</>}
                      </button>

                      {/* Copy Link */}
                      <button
                        onClick={() => handleCopyUrl(primaryFile?.downloadUrl || model.url, model.id)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        title="Copy download URL"
                      >
                        {copiedUrl === model.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      {/* External Link */}
                      <a
                        href={platformTab === 'civitai' ? `https://civitai.com/models/${model.id}` : model.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        title="Open on website"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {platformTab === 'civitai' && (
            <div className="flex items-center justify-between pt-6 border-t border-white/10">
              <span className="text-xs text-slate-400 font-medium">Page {page}</span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1 || status === 'loading'}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-bold transition-all"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <button
                  disabled={status === 'loading' || items.length < 20}
                  onClick={() => setPage(p => p + 1)}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-bold transition-all"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
