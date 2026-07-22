/**
 * Client-side ComfyUI JSON Workflow Parser & Link Extraction Engine
 */
import { normalizeModelFolder } from '../data/comfyuiFolders';

const toStr = (v) => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
};

/**
 * Deep scan and extract all download links, filenames, node types, and folders from any workflow JSON
 */
export function extractLinksFromWorkflowJson(jsonObj) {
  if (!jsonObj || typeof jsonObj !== 'object') {
    return [];
  }

  const results = [];
  const urlRegex = /https?:\/\/[^\s"']+/gi;
  const validExtensions = ['.safetensors', '.pth', '.gguf', '.ckpt', '.bin', '.onnx', '.pt'];

  const getFilenameFromUrl = (rawUrl) => {
    const url = toStr(rawUrl);
    if (!url) return '';
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      const last = parts.pop() || '';
      if (last.includes('.')) {
        return decodeURIComponent(last.split('?')[0]);
      }
    } catch (_) {}
    return url.split('/').pop().split('?')[0] || '';
  };

  const processNodeData = (nodeType, inputsOrWidgets, properties = {}) => {
    // 1. Scan properties models array
    if (properties && properties.models && Array.isArray(properties.models)) {
      properties.models.forEach(m => {
        if (!m) return;
        const url = toStr(m.url);
        const name = toStr(m.name || m.filename) || (url ? getFilenameFromUrl(url) : '');
        if (name || url) {
          results.push({
            name: name,
            url: url,
            folder: normalizeModelFolder(toStr(m.directory) || guessFolderFromNode(nodeType, name)),
            nodeType: toStr(nodeType)
          });
        }
      });
    }

    // 2. Scan inputs or widgets object / array
    const scanValue = (val, keyHint = '') => {
      if (!val) return;

      if (typeof val === 'string') {
        // Check if string contains http(s) URL
        const matches = val.match(urlRegex);
        if (matches) {
          matches.forEach(rawUrl => {
            const cleanUrl = rawUrl.replace(/[,\)"']+$/, '');
            const filename = getFilenameFromUrl(cleanUrl);
            results.push({
              name: filename,
              url: cleanUrl,
              folder: guessFolderFromNode(nodeType || keyHint, filename),
              nodeType: toStr(nodeType) || 'Downloader Node'
            });
          });
        } else {
          // Check if string ends with model extension
          const lower = val.toLowerCase();
          if (validExtensions.some(ext => lower.endsWith(ext))) {
            const filename = val.split(/[/\\]/).pop();
            results.push({
              name: filename,
              url: '',
              folder: guessFolderFromNode(nodeType || keyHint, filename),
              nodeType: toStr(nodeType) || 'Loader Node'
            });
          }
        }
      } else if (typeof val === 'object') {
        const rawUrl = toStr(val.url || val.link || val.download_url);
        const rawName = toStr(val.name || val.filename || val.model_name);

        if (rawUrl || rawName) {
          const url = rawUrl;
          const name = rawName || getFilenameFromUrl(url);
          if (name || url) {
            results.push({
              name: name,
              url: url,
              folder: normalizeModelFolder(toStr(val.folder) || guessFolderFromNode(nodeType, name)),
              nodeType: toStr(nodeType) || 'Downloader Node'
            });
          }
        } else {
          Object.entries(val).forEach(([k, v]) => scanValue(v, k));
        }
      }
    };

    if (Array.isArray(inputsOrWidgets)) {
      inputsOrWidgets.forEach(w => scanValue(w));
    } else if (inputsOrWidgets && typeof inputsOrWidgets === 'object') {
      Object.entries(inputsOrWidgets).forEach(([k, v]) => scanValue(v, k));
    }
  };

  // Check UI Graph format: jsonObj.nodes
  if (Array.isArray(jsonObj.nodes)) {
    jsonObj.nodes.forEach(node => {
      if (!node) return;
      processNodeData(node.type || node.class_type || '', node.widgets_values || node.inputs || {}, node.properties || {});
    });
  } else if (Array.isArray(jsonObj)) {
    jsonObj.forEach(node => {
      if (!node) return;
      processNodeData(node.type || node.class_type || '', node.widgets_values || node.inputs || {}, node.properties || {});
    });
  } else {
    // Check API Prompt format: jsonObj[node_id].class_type
    Object.values(jsonObj).forEach(val => {
      if (val && typeof val === 'object' && (val.class_type || val.inputs)) {
        processNodeData(val.class_type || '', val.inputs || {}, val.properties || {});
      }
    });
  }

  // Deduplicate extracted items by URL or Name
  const dedupped = new Map();
  results.forEach(r => {
    const urlStr = toStr(r.url);
    const nameStr = toStr(r.name);
    const key = (urlStr || nameStr).toLowerCase();
    if (key && !dedupped.has(key)) {
      dedupped.set(key, {
        id: 'extracted_' + Math.random().toString(36).substring(2, 9),
        name: nameStr || 'unnamed_model',
        url: urlStr,
        folder: normalizeModelFolder(r.folder || 'checkpoints'),
        nodeType: toStr(r.nodeType) || 'Node',
        size: 'Unknown'
      });
    }
  });

  return Array.from(dedupped.values());
}

export function parseComfyUIWorkflow(jsonObj, catalog = []) {
  if (!jsonObj || typeof jsonObj !== 'object') {
    throw new Error('Invalid JSON workflow format');
  }

  const extracted = extractLinksFromWorkflowJson(jsonObj);

  // Enrich extracted models with catalog metadata
  const catalogMap = new Map();
  (Array.isArray(catalog) ? catalog : []).forEach(item => {
    if (!item) return;
    const nameStr = toStr(item.name).toLowerCase();
    if (nameStr) catalogMap.set(nameStr, item);

    const urlStr = toStr(item.url);
    if (urlStr) {
      const baseName = urlStr.split('/').pop().toLowerCase();
      if (baseName) catalogMap.set(baseName, item);
    }
  });

  return extracted.map(m => {
    const mName = toStr(m.name).toLowerCase();
    const mUrl = toStr(m.url);
    const urlBase = mUrl ? mUrl.split('/').pop().toLowerCase() : '';

    const matched = (mName ? catalogMap.get(mName) : null) || (urlBase ? catalogMap.get(urlBase) : null) || {};

    return {
      ...m,
      name: m.name || matched.name || 'unnamed_model',
      url: mUrl || toStr(matched.url),
      size: m.size && m.size !== 'Unknown' ? m.size : (toStr(matched.size) || 'Unknown'),
      folder: normalizeModelFolder(m.folder || matched.folder || 'checkpoints'),
      source: 'workflow'
    };
  });
}

export function parseTextDownloadList(text, catalog = []) {
  const lines = toStr(text).split('\n');
  const items = [];

  const catalogMap = new Map();
  (Array.isArray(catalog) ? catalog : []).forEach(item => {
    if (!item) return;
    const nameStr = toStr(item.name).toLowerCase();
    if (nameStr) catalogMap.set(nameStr, item);
  });

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const parts = trimmed.split(/\s+/);
    if (parts.length >= 1 && parts[0].startsWith('http')) {
      const url = parts[0];
      const folder = normalizeModelFolder(parts[1] || 'checkpoints');
      const name = parts[2] ? parts[2] : url.split('/').pop();

      const matched = catalogMap.get(name.toLowerCase()) || {};

      items.push({
        id: 'mod_' + Math.random().toString(36).substring(2, 9),
        name: name,
        folder: folder,
        url: url,
        size: matched.size || 'Unknown',
        source: 'text_import'
      });
    }
  });

  return items;
}

export function guessFolderFromNode(nodeType, filename) {
  const type = toStr(nodeType).toLowerCase();
  const file = toStr(filename).toLowerCase();

  if (type.includes('vae') || file.includes('vae')) return 'vae';
  if (type.includes('clip') || type.includes('text') || file.includes('clip') || file.includes('t5') || file.includes('text_encoder')) return 'clip';
  if (type.includes('lora') || file.includes('lora')) return 'loras';
  if (type.includes('unet') || type.includes('diffusion') || file.includes('unet') || file.includes('diffusion')) return 'diffusion_models';
  if (type.includes('controlnet') || file.includes('controlnet')) return 'controlnet';
  if (type.includes('ipadapter') || file.includes('ipadapter') || file.includes('ip-adapter')) return 'ipadapter';
  if (type.includes('llm') || file.endsWith('.gguf') || file.includes('mistral')) return 'LLM';
  if (type.includes('depth') || type.includes('preprocessor') || file.endsWith('.pth')) return 'sams';
  return 'checkpoints';
}
