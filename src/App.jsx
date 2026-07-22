import React, { useState, useMemo, useEffect, useTransition, useRef, useCallback } from 'react';
import Header from './components/Header';
import { StorageOverview } from './components/StorageOverview';
import { WorkflowSelector } from './components/WorkflowSelector';
import { ModelTable } from './components/ModelTable';
import { AddModelModal } from './components/AddModelModal';
import { ScriptExporter } from './components/ScriptExporter';
import { TokenSettingsModal, loadTokens } from './components/TokenSettingsModal';
import { ModelSearchModal } from './components/ModelSearchModal';
import { ModelExplorer } from './components/ModelExplorer';
import { LinkAnalyzerModal } from './components/LinkAnalyzerModal';
import { calculateStorageBreakdown } from './services/sizeCalculator';

import { fetchRemoteFileSize } from './services/sizeFetcher';
import workflowData from './data/workflowsData.json';
import { useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
import { normalizeModelFolder } from './data/comfyuiFolders';

const MASTER_ADMIN_EMAIL = 'shubzveo@gmail.com';

export default function App() {
  const [, startTransition] = useTransition();
  const fetchAbortRef = useRef(null);

  const [workflows, setWorkflows] = useState(workflowData.workflows || []);
  const [catalog] = useState(workflowData.catalog || []);

  const [activeTab, setActiveTab] = useState('dashboard');

  // Pre-select popular image & video workflows by default
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState(() => {
    return (workflowData.workflows || [])
      .filter(wf => wf.category === '0-IMAGE' || wf.category === '2-VIDEO')
      .map(wf => wf.id);
  });

  const [storageQuotaGB, setStorageQuotaGB] = useState(80);
  const [activeFolderFilter, setActiveFolderFilter] = useState('all');

  // Theme Management (Dark vs Light)
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('simplepod_theme') || 'dark';
    } catch { return 'dark'; }
  });

  useEffect(() => {
    try { localStorage.setItem('simplepod_theme', theme); } catch {}
    document.body.classList.toggle('light-theme', theme === 'light');
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Dashboard Partitioning Layout Mode ('split' | 'stacked')
  const [dashboardLayout, setDashboardLayout] = useState(() => {
    try {
      return localStorage.getItem('simplepod_dashboard_layout') || 'split';
    } catch { return 'split'; }
  });

  const handleSetDashboardLayout = (mode) => {
    setDashboardLayout(mode);
    try { localStorage.setItem('simplepod_dashboard_layout', mode); } catch {}
  };


  // Custom user added model overrides, custom models, and community shared models
  const [customModels, setCustomModels] = useState([]);
  const [communityModels, setCommunityModels] = useState([]);

  // CivitAI models auto-loaded from civitai_download.txt on startup
  // Persisted to localStorage so they survive HMR reloads
  const [civitaiModels, setCivitaiModels] = useState(() => {
    try {
      const saved = localStorage.getItem('simplepod_civitai_models');
      if (!saved) return [];
      if (saved.includes('UTF-8') || saved.includes('utf-8') || saved.includes('Lenovo') || saved.includes('Amateur')) {
        localStorage.removeItem('simplepod_civitai_models');
        return [];
      }
      return JSON.parse(saved);
    } catch { return []; }
  });

  const [modelOverrides, setModelOverrides] = useState(() => {
    try {
      const saved = localStorage.getItem('simplepod_model_overrides');
      if (!saved) return {};
      if (saved.includes('UTF-8') || saved.includes('utf-8') || saved.includes('Lenovo') || saved.includes('Amateur')) {
        localStorage.removeItem('simplepod_model_overrides');
        return {};
      }
      return JSON.parse(saved);
    } catch { return {}; }
  });

  // Size fetching state
  const [isFetchingSizes, setIsFetchingSizes] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({ done: 0, total: 0 });

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isLinkAnalyzerOpen, setIsLinkAnalyzerOpen] = useState(false);
  // searchTarget: { modelId, query } — set when opening search from a model row
  const [searchTarget, setSearchTarget] = useState({ modelId: null, query: '' });


  // Token status (for header indicator dot)
  const hasTokens = useMemo(() => {
    const { hfToken, civitaiToken } = loadTokens();
    return Boolean(hfToken || civitaiToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTokenModalOpen]); // re-check after modal closes

  const { user, signOut } = useAuth();
  const isSyncingFromDbRef = useRef(false);

  // ── Load user preferences from Supabase when logged in ──────────────────────
  useEffect(() => {
    if (!user) {
      // Restore from localStorage when user logs out / guest mode
      try {
        const savedWfs = localStorage.getItem('simplepod_selected_workflows');
        if (savedWfs) setSelectedWorkflowIds(JSON.parse(savedWfs));
        else {
          setSelectedWorkflowIds(
            (workflowData.workflows || [])
              .filter(wf => wf.category === '0-IMAGE' || wf.category === '2-VIDEO')
              .map(wf => wf.id)
          );
        }
      } catch (_) {}

      try {
        const savedCustom = localStorage.getItem('simplepod_custom_models');
        setCustomModels(savedCustom ? JSON.parse(savedCustom) : []);
      } catch (_) {}

      try {
        const savedOverrides = localStorage.getItem('simplepod_model_overrides');
        if (savedOverrides) {
          if (savedOverrides.includes('UTF-8') || savedOverrides.includes('utf-8') || savedOverrides.includes('Lenovo') || savedOverrides.includes('Amateur')) {
            localStorage.removeItem('simplepod_model_overrides');
            setModelOverrides({});
          } else {
            setModelOverrides(JSON.parse(savedOverrides));
          }
        } else {
          setModelOverrides({});
        }
      } catch (_) {
        setModelOverrides({});
      }
      return;
    }

    // User is logged in — fetch preference tables from Supabase (incorporating Master Admin baseline)
    const loadUserDbData = async () => {
      isSyncingFromDbRef.current = true;
      try {
        const isMasterAdmin = user.email && user.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();

        let masterWfIds = null;
        let masterCustomModels = [];
        let masterOverridesMap = {};

        // If not master admin, load Master Admin's baseline rows first
        if (!isMasterAdmin) {
          try {
            const { data: masterWfData } = await supabase
              .from('user_selected_workflows')
              .select('selected_ids')
              .limit(1);
            if (masterWfData && masterWfData.length > 0) {
              masterWfIds = masterWfData[0].selected_ids;
            }

            const { data: masterCustomData } = await supabase
              .from('user_custom_models')
              .select('id, name, folder, url, size');
            if (masterCustomData) {
              masterCustomModels = masterCustomData;
            }

            const { data: masterOverrideData } = await supabase
              .from('user_model_overrides')
              .select('model_id, folder, name, size, is_removed');
            if (masterOverrideData) {
              masterOverrideData.forEach(row => {
                masterOverridesMap[row.model_id] = {
                  folder: row.folder,
                  name: row.name,
                  size: row.size,
                  isRemoved: row.is_removed
                };
              });
            }
          } catch (e) {
            console.warn('[App] Could not load Master Admin baseline:', e);
          }
        }

        // 1. Fetch Current User Selected Workflows
        const { data: wfData } = await supabase
          .from('user_selected_workflows')
          .select('selected_ids')
          .eq('user_id', user.id)
          .maybeSingle();
        if (wfData?.selected_ids) {
          setSelectedWorkflowIds(wfData.selected_ids);
        } else if (masterWfIds) {
          setSelectedWorkflowIds(masterWfIds);
        }

        // 2. Fetch Current User Custom Models
        const { data: customData } = await supabase
          .from('user_custom_models')
          .select('id, name, folder, url, size')
          .eq('user_id', user.id);

        const userCustomModels = customData || [];
        const mergedCustom = [...userCustomModels];
        const userCustomIds = new Set(userCustomModels.map(m => m.id));
        masterCustomModels.forEach(m => {
          if (!userCustomIds.has(m.id)) {
            mergedCustom.push(m);
          }
        });
        if (mergedCustom.length > 0) {
          setCustomModels(mergedCustom);
        }

        // 3. Fetch Current User Overrides
        const { data: overrideData } = await supabase
          .from('user_model_overrides')
          .select('model_id, folder, name, size, is_removed')
          .eq('user_id', user.id);

        const userOverridesMap = {};
        if (overrideData) {
          overrideData.forEach(row => {
            userOverridesMap[row.model_id] = {
              folder: row.folder,
              name: row.name,
              size: row.size,
              isRemoved: row.is_removed
            };
          });
        }
        const finalOverridesMap = { ...masterOverridesMap, ...userOverridesMap };
        if (Object.keys(finalOverridesMap).length > 0) {
          setModelOverrides(finalOverridesMap);
        }

        // 4. Fetch Publicly Shared Community Models from other users
        const { data: publicData } = await supabase
          .from('user_custom_models')
          .select('id, name, folder, url, size, is_public, user_id')
          .eq('is_public', true)
          .neq('user_id', user.id);
        if (publicData) {
          setCommunityModels(publicData.map(m => ({ ...m, catalogOrigin: 'community', isPublic: true })));
        }
      } finally {
        // Yield execution to allow states to flush
        setTimeout(() => {
          isSyncingFromDbRef.current = false;
        }, 100);
      }
    };

    loadUserDbData().catch(err => {
      console.error('[App] Error loading user database preferences:', err);
      isSyncingFromDbRef.current = false;
    });
  }, [user]);

  // Sync Selected Workflows to Supabase/localStorage
  useEffect(() => {
    if (isSyncingFromDbRef.current) return;
    if (user) {
      const syncWorkflows = async () => {
        const { error } = await supabase.from('user_selected_workflows').upsert({
          user_id: user.id,
          selected_ids: selectedWorkflowIds,
          updated_at: new Date().toISOString()
        });
        if (error) console.warn('[App] Error syncing selected workflows:', error.message);
      };
      syncWorkflows().catch(err => console.warn('[App] Exception syncing selected workflows:', err));
    } else {
      try { localStorage.setItem('simplepod_selected_workflows', JSON.stringify(selectedWorkflowIds)); } catch {}
    }
  }, [selectedWorkflowIds, user]);

  // Sync Custom Models to Supabase/localStorage
  useEffect(() => {
    if (isSyncingFromDbRef.current) return;
    if (user) {
      const syncCustom = async () => {
        await supabase.from('user_custom_models').delete().eq('user_id', user.id);
        if (customModels.length > 0) {
          const rows = customModels.map(m => ({
            user_id: user.id,
            id: m.id,
            name: m.name || null,
            folder: m.folder || 'checkpoints',
            url: m.url || '',
            size: m.size || 'Unknown',
            is_public: Boolean(m.isPublic)
          }));
          await supabase.from('user_custom_models').insert(rows);
        }
      };
      syncCustom().catch(err => console.warn('[App] Error syncing custom models:', err));
    } else {
      try { localStorage.setItem('simplepod_custom_models', JSON.stringify(customModels)); } catch {}
    }
  }, [customModels, user]);

  // Sync Model Overrides to Supabase/localStorage
  useEffect(() => {
    if (isSyncingFromDbRef.current) return;
    if (user) {
      const syncOverrides = async () => {
        const rows = Object.entries(modelOverrides).map(([id, item]) => ({
          user_id: user.id,
          model_id: id,
          folder: item.folder || null,
          name: item.name || null,
          size: item.size || null,
          is_removed: Boolean(item.isRemoved),
          updated_at: new Date().toISOString()
        }));
        if (rows.length > 0) {
          await supabase.from('user_model_overrides').upsert(rows);
        }
      };
      syncOverrides().catch(err => console.warn('[App] Error syncing model overrides:', err));
    } else {
      try { localStorage.setItem('simplepod_model_overrides', JSON.stringify(modelOverrides)); } catch {}
    }
  }, [modelOverrides, user]);

  // Workflow Selection handlers
  const handleToggleWorkflow = (id) => {
    setSelectedWorkflowIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllWorkflows = () => {
    setSelectedWorkflowIds(workflows.map(wf => wf.id));
  };

  const handleClearWorkflowSelection = () => {
    setSelectedWorkflowIds([]);
  };

  const handleCustomWorkflowUploaded = (newWf) => {
    setWorkflows(prev => [newWf, ...prev]);
    setSelectedWorkflowIds(prev => [...prev, newWf.id]);
  };

  // ── Auto-load civitai_download.txt once on mount ─────────────────────────
  useEffect(() => {
    const normName = (n = '') =>
      n.toLowerCase().trim().replace(/\.(safetensors|ckpt|pt|bin|onnx|pth|gguf|zip)$/i, '');

    // 1. Load civitai_download.txt
    fetch('/api/import-civitai-file')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const fetched = data.models || [];
        if (!fetched.length) return;

        const allWorkflowModels = (workflowData.workflows || []).flatMap(wf => wf.models || []);
        const wfNames = new Set(allWorkflowModels.map(m => normName(m.name || m.filename || '')));
        const wfVersionIds = new Set(
          allWorkflowModels
            .map(m => { const match = (m.url || '').match(/\/models\/(\d+)/); return match?.[1]; })
            .filter(Boolean)
        );

        const storedVersionIds = new Set(
          civitaiModels
            .map(m => { const match = (m.url || '').match(/\/models\/(\d+)/); return match?.[1]; })
            .filter(Boolean)
        );
        const storedNames = new Set(civitaiModels.map(m => normName(m.name || '')));

        const newOnes = fetched.filter(m => {
          const vid = (m.url || '').match(/\/models\/(\d+)/)?.[1];
          const nm  = normName(m.name);
          if (vid && (wfVersionIds.has(vid) || storedVersionIds.has(vid))) return false;
          if (wfNames.has(nm) || storedNames.has(nm)) return false;
          return true;
        });

        if (newOnes.length) {
          setCivitaiModels(prev => {
            const merged = [...prev, ...newOnes];
            try { localStorage.setItem('simplepod_civitai_models', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
      })
      .catch(() => {});

    // 2. Auto-load all master links from /api/load-model-list & Supabase online catalog
    const loadCatalog = async () => {
      let fetched = [];
      try {
        const r = await fetch('/api/load-model-list');
        if (r.ok) {
          const data = await r.json();
          fetched = data.models || [];
        }
      } catch (_) {}

      // Fetch online catalog directly from Supabase DB tables if connected
      if (supabase) {
        try {
          const { data: dbModels } = await supabase
            .from('model_list')
            .select('id, url, folder, source, name, size');
          if (dbModels && dbModels.length > 0) {
            const { data: cacheRows } = await supabase
              .from('model_cache')
              .select('clean_url, name, size, folder');
            const cacheMap = {};
            (cacheRows || []).forEach(c => { if (c.clean_url) cacheMap[c.clean_url] = c; });

            const supaModels = dbModels.map(m => {
              const cKey = m.url ? m.url.replace('civitai.red', 'civitai.com').replace(/[?&]token=[a-zA-Z0-9_-]+/g, '').replace(/\?&/, '?').replace(/[?&]$/, '') : '';
              const cached = cacheMap[cKey] || {};
              return {
                id: m.id,
                url: m.url,
                name: cached.name || m.name || '',
                folder: cached.folder || m.folder || 'checkpoints',
                size: cached.size || m.size || '',
                source: m.source || 'file'
              };
            });

            const urlSet = new Set(fetched.map(x => (x.url || '').toLowerCase()));
            supaModels.forEach(sm => {
              if (sm.url && !urlSet.has(sm.url.toLowerCase())) {
                fetched.push(sm);
              }
            });
          }
        } catch (supaErr) {
          console.warn('[App] Could not fetch online catalog from Supabase:', supaErr);
        }
      }

      if (!fetched.length) return;

      setCivitaiModels(prev => {
        const isStaleName = (n) => !n || n.toLowerCase().includes('lenovo') || n.toLowerCase().includes('amateur') || /^\d+$/.test(n) || n.startsWith('civitai_');
        const mergedMap = new Map();
        fetched.forEach(m => {
          if (m.url) mergedMap.set(m.url.toLowerCase(), m);
        });
        prev.forEach(m => {
          if (!m.url) return;
          const key = m.url.toLowerCase();
          const existing = mergedMap.get(key);
          if (!existing) {
            mergedMap.set(key, m);
          } else {
            if (isStaleName(existing.name) && !isStaleName(m.name)) {
              existing.name = m.name;
            }
            if ((!existing.size || existing.size === 'Unknown') && m.size && m.size !== 'Unknown') {
              existing.size = m.size;
            }
          }
        });
        const merged = Array.from(mergedMap.values());
        try { localStorage.setItem('simplepod_civitai_models', JSON.stringify(merged)); } catch {}
        console.log(`[model-list] Auto-loaded ${merged.length} models from local files & Supabase online catalog`);
        return merged;
      });
    };

    loadCatalog();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);




  const activeModelsList = useMemo(() => {
    const modelsMap = new Map();

    const selectedWfs = workflows.filter(wf => selectedWorkflowIds.includes(wf.id));
    
    selectedWfs.forEach(wf => {
      (wf.models || []).forEach(m => {
        const nameKey = (m.name || m.filename || '').toLowerCase();
        const urlKey = (m.url || '').toLowerCase();
        const key = urlKey || nameKey || m.id;
        if (key && !modelsMap.has(key)) {
          modelsMap.set(key, {
            id: 'm_' + key,
            name: m.name || m.filename || '',
            folder: normalizeModelFolder(m.folder),
            url: m.url || '',
            size: m.size || 'Unknown',
            nodeType: m.nodeType || '',
            source: wf.name,
            catalogOrigin: 'master'
          });
        }
      });
    });

    // Merge civitai models / master list models — preserve all unique URLs & attach URLs to unlinked workflow models
    civitaiModels.forEach(cm => {
      const urlKey = cm.url ? cm.url.toLowerCase() : '';
      const nameKey = cm.name ? cm.name.toLowerCase() : '';

      // If a model with same filename exists without a download URL, attach this URL!
      if (nameKey && modelsMap.has(nameKey)) {
        const existing = modelsMap.get(nameKey);
        if (!existing.url && cm.url) {
          existing.url = cm.url;
          if (cm.size && cm.size !== 'Unknown') existing.size = cm.size;
        }
      }

      const key = urlKey || (nameKey && !['lenovo.safetensors', 'model.safetensors'].includes(nameKey) ? nameKey : '') || cm.id;

      if (key && !modelsMap.has(key)) {
        modelsMap.set(key, {
          id: cm.id || 'm_' + key,
          name: cm.name || '',
          folder: normalizeModelFolder(cm.folder || 'checkpoints'),
          url: cm.url || '',
          size: cm.size || 'Unknown',
          source: cm.source || 'file',
          catalogOrigin: 'master'
        });
      }
    });

    // Merge Public Community Shared Models from other users
    communityModels.forEach(cm => {
      const key = (cm.url || cm.name || cm.id || '').toLowerCase();
      if (key && !modelsMap.has(key)) {
        modelsMap.set(key, {
          ...cm,
          catalogOrigin: 'community'
        });
      }
    });

    // Custom user models always win (added last, override everything)
    customModels.forEach(cm => {
      const key = (cm.url || cm.name || cm.id || '').toLowerCase();
      if (key) modelsMap.set(key, {
        ...cm,
        catalogOrigin: 'personal'
      });
    });

    const list = Array.from(modelsMap.values()).map(m => {
      const merged = modelOverrides[m.id] ? { ...m, ...modelOverrides[m.id] } : { ...m };
      let cleanName = String(merged.name || '').trim()
        .replace(/^(UTF-8|utf-8|utf8|UTF8)['"%27]*['"%27]*/gi, '')
        .replace(/^''/g, '')
        .replace(/['"]/g, '')
        .trim();

      if (merged.url && (merged.url.includes('huggingface.co') || !cleanName || cleanName.startsWith('UTF') || /^\d+$/.test(cleanName))) {
        try {
          const pathname = new URL(merged.url).pathname;
          const lastPart = pathname.split('/').filter(Boolean).pop();
          if (lastPart && /\.(safetensors|ckpt|pt|bin|onnx|pth|gguf)$/i.test(lastPart)) {
            cleanName = decodeURIComponent(lastPart);
          }
        } catch (_) {}
      }

      return {
        ...merged,
        name: cleanName || m.name || '',
        folder: normalizeModelFolder(merged.folder || m.folder),
      };
    });

    return list;
  }, [workflows, selectedWorkflowIds, civitaiModels, customModels, modelOverrides]);

  const activeModelsFiltered = useMemo(() => {
    return activeModelsList.filter(m => !modelOverrides[m.id]?.isRemoved);
  }, [activeModelsList, modelOverrides]);

  // Auto-resolve CivitAI model names if they are numeric IDs or civitai_* (guarded against re-render loops)
  const attemptedResolveRef = useRef(new Set());

  useEffect(() => {
    if (!activeModelsFiltered.length) return;

    // Group URLs by name to find conflicts (same name, different URLs)
    const nameUrls = {};
    activeModelsFiltered.forEach(m => {
      if (m.name && m.url) {
        if (!nameUrls[m.name]) nameUrls[m.name] = new Set();
        nameUrls[m.name].add(m.url.split('?')[0]);
      }
    });

    const unmappedCivitai = activeModelsFiltered.filter(m => 
      m.url &&
      (
        !m.name || 
        /^\d+$/.test(m.name) || 
        m.name.startsWith('civitai_') || 
        (nameUrls[m.name] && nameUrls[m.name].size > 1 && !attemptedResolveRef.current.has(m.id + '_dup'))
      ) &&
      !attemptedResolveRef.current.has(m.id)
    );

    if (!unmappedCivitai.length) return;

    // Mark these model IDs as attempted to prevent infinite loop re-renders
    unmappedCivitai.forEach(m => {
      attemptedResolveRef.current.add(m.id);
      if (nameUrls[m.name] && nameUrls[m.name].size > 1) attemptedResolveRef.current.add(m.id + '_dup');
    });

    fetch('/api/resolve-civitai-names', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ models: unmappedCivitai, force: true })
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || !data.resolved || !Object.keys(data.resolved).length) return;
        const resolvedMap = data.resolved;

        setCivitaiModels(prev => {
          const next = prev.map(m => resolvedMap[m.id] ? { ...m, name: resolvedMap[m.id] } : m);
          try { localStorage.setItem('simplepod_civitai_models', JSON.stringify(next)); } catch {}
          return next;
        });

        setModelOverrides(prev => {
          const next = { ...prev };
          Object.entries(resolvedMap).forEach(([id, realName]) => {
            next[id] = { ...(next[id] || {}), name: realName };
          });
          try { localStorage.setItem('simplepod_model_overrides', JSON.stringify(next)); } catch {}
          return next;
        });

        console.log(`[civitai-resolver] Auto-resolved ${Object.keys(resolvedMap).length} CivitAI filenames`);
      })
      .catch(() => {});
  }, [activeModelsFiltered]);


  // Count missing sizes
  const missingSizesCount = useMemo(() => {
    return activeModelsFiltered.filter(m => (!m.size || m.size === 'Unknown') && m.url).length;
  }, [activeModelsFiltered]);

  // Storage calculation
  const breakdownData = useMemo(() => {
    return calculateStorageBreakdown(activeModelsFiltered);
  }, [activeModelsFiltered]);

  // SAVE TO DISK & CLOUD FUNCTION
  const handleSaveToDisk = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/save-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models: activeModelsFiltered })
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        throw new Error('Server error saving file');
      }
    } catch (err) {
      // Fallback: Generate download.txt file in browser
      const lines = ["# SIMPLEPOD MASTER MODEL LIST\n"];
      activeModelsFiltered.forEach(m => {
        if (m.url) {
          lines.push(`${m.url} ${normalizeModelFolder(m.folder)} ${m.name || ''}`);
        }
      });
      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'download.txt';
      link.click();
      URL.revokeObjectURL(url);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }

    // Upsert analyzed sizes directly to Supabase cloud database
    if (supabase) {
      try {
        const cacheRows = activeModelsFiltered
          .filter(m => m && m.url && m.size && m.size !== 'Unknown')
          .map(m => {
            const key = m.url.replace('civitai.red', 'civitai.com').replace(/[?&]token=[a-zA-Z0-9_-]+/g, '').replace(/\?&/, '?').replace(/[?&]$/, '');
            if (!key) return null;
            const row = { clean_url: key, size: m.size };
            if (m.name && !/^\d+$/.test(m.name) && !m.name.startsWith('civitai_')) row.name = m.name;
            if (m.folder) row.folder = m.folder;
            return row;
          })
          .filter(Boolean);

        for (let i = 0; i < cacheRows.length; i += 100) {
          await supabase.from('model_cache').upsert(cacheRows.slice(i, i + 100), { onConflict: 'clean_url' });
        }
      } catch (err) {
        console.warn('[App] Exception saving analyzed sizes to cloud model_cache:', err);
      }

      // Master Admin: Publish baseline catalog to shared global model_list table
      if (user && user.email && user.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) {
        try {
          const listRows = activeModelsFiltered
            .filter(m => m && m.url)
            .map(m => ({
              id: m.id,
              url: m.url,
              name: m.name || null,
              folder: (m.folder || 'checkpoints').replace(/^models\//i, ''),
              size: m.size || null,
              source: 'master_admin',
            }));
          if (listRows.length > 0) {
            for (let i = 0; i < listRows.length; i += 100) {
              await supabase.from('model_list').upsert(listRows.slice(i, i + 100), { onConflict: 'id' });
            }
          }
        } catch (err) {
          console.warn('[App] Exception publishing master admin catalog to model_list:', err);
        }
      }
    }

    setIsSaving(false);
  };

  // ── FETCH MISSING/RE-SCAN SIZES & NAMES: concurrent batching, batched state flushes ──────
  const handleFetchMissingSizes = async () => {
    // 1. Force resolve all CivitAI & HF model filenames first
    fetch('/api/resolve-civitai-names', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ models: activeModelsFiltered, force: true })
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || !data.resolved || !Object.keys(data.resolved).length) return;
        const resolvedMap = data.resolved;
        setCivitaiModels(prev => {
          const next = prev.map(m => resolvedMap[m.id] ? { ...m, name: resolvedMap[m.id] } : m);
          try { localStorage.setItem('simplepod_civitai_models', JSON.stringify(next)); } catch {}
          return next;
        });
        setModelOverrides(prev => {
          const next = { ...prev };
          Object.entries(resolvedMap).forEach(([id, realName]) => {
            next[id] = { ...(next[id] || {}), name: realName };
          });
          try { localStorage.setItem('simplepod_model_overrides', JSON.stringify(next)); } catch {}
          return next;
        });
      })
      .catch(() => {});

    // 2. Select targets for size scan (if no missing sizes, re-scan all models with valid URLs)
    let targets = activeModelsFiltered.filter(m => (!m.size || m.size === 'Unknown') && m.url);
    if (targets.length === 0) {
      targets = activeModelsFiltered.filter(m => m.url && m.url.startsWith('http'));
    }

    if (targets.length === 0) return;

    setIsFetchingSizes(true);
    setFetchProgress({ done: 0, total: targets.length });

    // Abort any in-progress previous run
    if (fetchAbortRef.current) fetchAbortRef.current.abort();
    const abortController = new AbortController();
    fetchAbortRef.current = abortController;

    const CONCURRENCY = 4;   // fetch 4 models in parallel
    const BATCH_FLUSH = 8;   // flush state every 8 successes
    const TIMEOUT_MS  = 8000;

    const freshUpdates = {};  // local accumulator — avoids React async race
    let done = 0;

    // Flush accumulated updates to React state (batched, non-blocking)
    const flushToState = (isLast = false) => {
      const snapshot = { ...freshUpdates };
      startTransition(() => {
        setModelOverrides(prev => {
          const next = { ...prev };
          for (const [id, upd] of Object.entries(snapshot)) {
            next[id] = { ...(next[id] || {}), ...upd };
          }
          try { localStorage.setItem('simplepod_model_overrides', JSON.stringify(next)); } catch {}
          return next;
        });
      });
    };

    // Fetch with per-request timeout
    const fetchWithTimeout = async (model) => {
      const timer = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS));
      try {
        const sizeResult = await Promise.race([fetchRemoteFileSize(model.url), timer]);
        if (sizeResult && typeof sizeResult === 'object') {
          const updates = {};
          if (sizeResult.size && sizeResult.size !== 'Unknown') updates.size = sizeResult.size;
          const isStaleName = (n) => !n || n.toLowerCase().includes('lenovo') || n.toLowerCase().includes('amateur') || /^\d+$/.test(n) || n.startsWith('civitai_');
          if (sizeResult.name && (isStaleName(model.name) || model.name === 'model.safetensors')) {
            updates.name = sizeResult.name;
          }
          if (sizeResult.error) {
            updates.error = sizeResult.error;
          }
          if (Object.keys(updates).length > 0) {
            freshUpdates[model.id] = updates;
          }
        } else if (sizeResult && sizeResult !== 'Unknown') {
          freshUpdates[model.id] = { size: sizeResult };
        }
      } catch (e) {
        // timeout or network error — skip silently
      }
    };

    // Process in batches of CONCURRENCY
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      if (abortController.signal.aborted) break;

      const batch = targets.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(fetchWithTimeout));

      done += batch.length;

      // Update progress (non-urgent — won't block input)
      startTransition(() => {
        setFetchProgress({ done: Math.min(done, targets.length), total: targets.length });
      });

      // Flush state every BATCH_FLUSH completions
      if (done % BATCH_FLUSH < CONCURRENCY) {
        flushToState();
      }
    }

    // Final flush — ensure all remaining updates hit state
    flushToState(true);
    setIsFetchingSizes(false);
    setFetchProgress(prev => ({ ...prev, done: targets.length }));

    // Build final model list for disk save
    const finalModels = activeModelsFiltered.map(m =>
      freshUpdates[m.id] ? { ...m, ...freshUpdates[m.id] } : m
    );

    // Save to disk & Cloud Supabase model_cache
    setIsSaving(true);
    try {
      const res = await fetch('/api/save-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models: finalModels })
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (_) { /* backend offline */ }

    // Upsert analyzed sizes directly to Supabase cloud database
    if (supabase) {
      try {
        const cacheRows = finalModels
          .filter(m => m && m.url && m.size && m.size !== 'Unknown')
          .map(m => {
            const key = m.url.replace('civitai.red', 'civitai.com').replace(/[?&]token=[a-zA-Z0-9_-]+/g, '').replace(/\?&/, '?').replace(/[?&]$/, '');
            if (!key) return null;
            const row = { clean_url: key, size: m.size };
            if (m.name && !/^\d+$/.test(m.name) && !m.name.startsWith('civitai_')) row.name = m.name;
            if (m.folder) row.folder = m.folder;
            return row;
          })
          .filter(Boolean);

        for (let i = 0; i < cacheRows.length; i += 100) {
          await supabase.from('model_cache').upsert(cacheRows.slice(i, i + 100), { onConflict: 'clean_url' });
        }
      } catch (err) {
        console.warn('[App] Exception saving analyzed sizes to cloud model_cache:', err);
      }
    }

    setIsSaving(false);
  };

  // Update any field on any model by id — checks customModels first, then modelOverrides
  const handleUpdateModel = useCallback((modelId, updates) => {
    // Update custom models if the id matches
    setCustomModels(prev => {
      const idx = prev.findIndex(m => m.id === modelId);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...updates };
        return next;
      }
      return prev;
    });
    // Always patch modelOverrides too (covers workflow models with overrides)
    setModelOverrides(prev => {
      const next = { ...prev, [modelId]: { ...(prev[modelId] || {}), ...updates } };
      return next;
    });
  }, []);

  const handleTogglePublicModel = useCallback((modelId, isPublic) => {
    setCustomModels(prev => prev.map(m => m.id === modelId ? { ...m, isPublic } : m));
  }, []);

  const handleBulkUpdateModels = (bulkMap) => {
    setCustomModels(prev => {
      return prev.map(m => {
        if (bulkMap[m.id]) {
          return { ...m, ...bulkMap[m.id] };
        }
        return m;
      });
    });
    setModelOverrides(prev => {
      const next = { ...prev };
      Object.entries(bulkMap).forEach(([id, updates]) => {
        next[id] = { ...(next[id] || {}), ...updates };
      });
      return next;
    });
  };


  const handleRemoveModel = useCallback((id) => {
    setCustomModels(prev => prev.filter(m => m.id !== id));
    setModelOverrides(prev => {
      const next = { ...prev, [id]: { ...(prev[id] || {}), isRemoved: true } };
      return next;
    });
  }, []);

  const handleAddModel = (newModel) => {
    setCustomModels(prev => [newModel, ...prev]);
  };

  const handleBulkAddModels = (newModels) => {
    setCustomModels(prev => [...newModels, ...prev]);
  };


  // Open search modal targeting a specific model row
  const handleSearchModel = useCallback((modelId, modelName) => {
    setSearchTarget({ modelId, query: modelName || '' });
    setIsSearchModalOpen(true);
  }, []);

  // Called when user picks a search result to attach to a model
  const handleSearchAttach = (modelId, { url, size, name }) => {
    const updates = {};
    if (url) updates.url = url;
    if (size && size !== 'Unknown') updates.size = size;
    if (modelId) {
      handleUpdateModel(modelId, updates);
    }
  };

  const activeSelectedWorkflows = workflows.filter(wf => selectedWorkflowIds.includes(wf.id));

  return (
    <div className="theme-shell min-h-screen flex flex-col selection:bg-violet-500 selection:text-white">
      
      {/* Top Sticky Header */}
      <Header
        totalMB={breakdownData.totalMB}
        storageQuotaGB={storageQuotaGB}
        setStorageQuotaGB={setStorageQuotaGB}
        activeModelsCount={activeModelsFiltered.length}
        activeWorkflowsCount={selectedWorkflowIds.length}
        missingCount={missingSizesCount}
        isFetchingSizes={isFetchingSizes}
        fetchProgress={fetchProgress}
        onFetchMissingSizes={handleFetchMissingSizes}
        onSaveToDisk={handleSaveToDisk}
        isSaving={isSaving}
        saveSuccess={saveSuccess}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenTokenSettings={() => setIsTokenModalOpen(true)}
        onOpenLinkAnalyzer={() => setIsLinkAnalyzerOpen(true)}
        hasTokens={hasTokens}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        user={user}
        onSignOut={signOut}
      />


      {/* 100% FULL BROWSER WIDTH CONTAINER */}
      <main className="flex-1 w-full px-3 sm:px-4 lg:px-6 py-4 space-y-4">
        
        {/* TAB 1: WORKFLOWS & STORAGE DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-3 lg:min-h-[calc(100vh-9rem)] lg:flex lg:flex-col">

            {/* Dashboard Partitioning Control Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/60 p-2 rounded-xl border border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">Dashboard Layout:</span>
                <button
                  onClick={() => handleSetDashboardLayout('split')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    dashboardLayout === 'split'
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-white/5'
                  }`}
                >
                  ⚡ Side-by-Side Split View
                </button>
                <button
                  onClick={() => handleSetDashboardLayout('stacked')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    dashboardLayout === 'stacked'
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-white/5'
                  }`}
                >
                  📊 Full Stacked Cards
                </button>
              </div>

              <div className="text-xs font-mono text-cyan-300 font-bold hidden sm:block">
                Volume: {breakdownData.totalFormatted} ({((breakdownData.totalMB / 1024 / storageQuotaGB) * 100).toFixed(1)}% of {storageQuotaGB}GB)
              </div>
            </div>

            {/* DASHBOARD LAYOUT 1: SIDE-BY-SIDE SPLIT VIEW */}
            {dashboardLayout === 'split' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start lg:items-stretch lg:flex-1 lg:min-h-0">
                {/* Left 4 Cols: Sticky Storage Panel */}
                <div className="lg:col-span-4 lg:h-full">
                  <StorageOverview
                    breakdownData={breakdownData}
                    storageQuotaGB={storageQuotaGB}
                    activeFolderFilter={activeFolderFilter}
                    setActiveFolderFilter={setActiveFolderFilter}
                    compact={true}
                  />
                </div>

                {/* Right 8 Cols: Scrollable Workflows Selector */}
                <div className="lg:col-span-8 lg:h-full">
                  <WorkflowSelector
                    workflowsList={workflows}
                    selectedWorkflowIds={selectedWorkflowIds}
                    onToggleWorkflow={handleToggleWorkflow}
                    onSelectAllWorkflows={handleSelectAllWorkflows}
                    onClearWorkflowSelection={handleClearWorkflowSelection}
                    onCustomWorkflowUploaded={handleCustomWorkflowUploaded}
                    catalog={catalog}
                  />
                </div>
              </div>
            ) : (

              /* DASHBOARD LAYOUT 2: FULL STACKED CARDS VIEW */
              <div className="space-y-4">
                <StorageOverview
                  breakdownData={breakdownData}
                  storageQuotaGB={storageQuotaGB}
                  activeFolderFilter={activeFolderFilter}
                  setActiveFolderFilter={setActiveFolderFilter}
                  compact={false}
                />

                <WorkflowSelector
                  workflowsList={workflows}
                  selectedWorkflowIds={selectedWorkflowIds}
                  onToggleWorkflow={handleToggleWorkflow}
                  onSelectAllWorkflows={handleSelectAllWorkflows}
                  onClearWorkflowSelection={handleClearWorkflowSelection}
                  onCustomWorkflowUploaded={handleCustomWorkflowUploaded}
                  catalog={catalog}
                />
              </div>
            )}

          </div>
        )}


        {/* TAB 2: MODEL DOWNLOAD LIST & FOLDER REORGANIZER */}
        {activeTab === 'manager' && (
          <ModelTable
            modelsList={activeModelsFiltered}
            onUpdateModel={handleUpdateModel}
            onRemoveModel={handleRemoveModel}
            activeFolderFilter={activeFolderFilter}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onFetchMissingSizes={handleFetchMissingSizes}
            isFetchingSizes={isFetchingSizes}
            onSaveToDisk={handleSaveToDisk}
            saveSuccess={saveSuccess}
            onSearchModel={handleSearchModel}
            onOpenSearch={() => { setSearchTarget({ modelId: null, query: '' }); setIsSearchModalOpen(true); }}
            onOpenLinkAnalyzer={() => setIsLinkAnalyzerOpen(true)}
            onTogglePublicModel={handleTogglePublicModel}
          />
        )}



        {/* TAB 3: MODEL EXPLORER */}
        {activeTab === 'explorer' && (
          <ModelExplorer
            onAddModel={handleAddModel}
            existingModels={activeModelsFiltered}
          />
        )}

        {/* TAB 4: EXPORT SCRIPT */}
        {activeTab === 'export' && (
          <div className="sv-card rounded-3xl p-8 max-w-4xl mx-auto text-center space-y-6">
            <h2 className="text-2xl font-black text-white">Generate Cloud Pod Scripts</h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Export your reorganized model links into standard `download.txt` or a complete executable `download.py` script for RunPod, SimplePod, or Vast.ai.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 text-white font-bold text-sm shadow-xl shadow-violet-600/30"
              >
                Open Script Exporter Studio
              </button>
              <button
                onClick={handleSaveToDisk}
                className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/30"
              >
                Save to download.txt on Disk
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="theme-footer border-t py-5 px-6 md:px-10 text-center text-xs">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>Silicon Valley ComfyUI Model Calculator & Workflow Reorganizer</div>
          <div className="flex items-center gap-4">
            <span>ComfyUI Pod Ready</span>
            <span>•</span>
            <span>HuggingFace & CivitAI Compatible</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AddModelModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddModel={handleAddModel}
        onBulkAddModels={handleBulkAddModels}
        onUpdateModel={handleUpdateModel}
        existingModels={activeModelsFiltered}
        catalog={catalog}
      />

      <ScriptExporter
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        modelsList={activeModelsFiltered}
        selectedWorkflows={activeSelectedWorkflows}
      />

      <TokenSettingsModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
      />

      <ModelSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => { setIsSearchModalOpen(false); setSearchTarget({ modelId: null, query: '' }); }}
        initialQuery={searchTarget.query}
        targetModelId={searchTarget.modelId}
        onAttachUrl={handleSearchAttach}
      />

      <LinkAnalyzerModal
        isOpen={isLinkAnalyzerOpen}
        onClose={() => setIsLinkAnalyzerOpen(false)}
        modelsList={activeModelsFiltered}
        onUpdateModel={handleUpdateModel}
        onBulkUpdateModels={handleBulkUpdateModels}
        onRemoveModel={handleRemoveModel}
      />

    </div>
  );
}

