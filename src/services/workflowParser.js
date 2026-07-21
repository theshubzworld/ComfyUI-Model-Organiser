/**
 * Client-side ComfyUI JSON Workflow Parser & Model Detection Engine
 */
import { normalizeModelFolder } from '../data/comfyuiFolders';

export function parseComfyUIWorkflow(jsonObj, catalog = []) {
  if (!jsonObj || typeof jsonObj !== 'object') {
    throw new Error('Invalid JSON workflow format');
  }

  const nodes = jsonObj.nodes || (Array.isArray(jsonObj) ? jsonObj : []);
  const extractedModels = [];

  // Build catalog lookups
  const catalogMap = new Map();
  catalog.forEach(item => {
    if (item.name) catalogMap.set(item.name.toLowerCase(), item);
    if (item.url) {
      const baseName = item.url.split('/').pop().toLowerCase();
      catalogMap.set(baseName, item);
    }
  });

  const validExtensions = ['.safetensors', '.pth', '.gguf', '.ckpt', '.bin', '.onnx', '.pt'];

  nodes.forEach(node => {
    const nodeType = node.type || '';
    const widgets = node.widgets_values || [];
    const props = node.properties || {};

    // 1. Check node properties models array (e.g. CLIPLoader / VAELoader metadata)
    if (props.models && Array.isArray(props.models)) {
      props.models.forEach(m => {
        if (m.name) {
          extractedModels.push({
            name: m.name,
            nodeType: nodeType,
            folder: normalizeModelFolder(m.directory || guessFolderFromNode(nodeType, m.name)),
            url: m.url || ''
          });
        }
      });
    }

    // 2. Check widget values for model filenames
    if (Array.isArray(widgets)) {
      widgets.forEach(w => {
        if (typeof w === 'string') {
          const lowerW = w.toLowerCase();
          const hasExt = validExtensions.some(ext => lowerW.endsWith(ext));
          
          if (hasExt) {
            const filename = w.split(/[/\\]/).pop();
            extractedModels.push({
              name: filename,
              nodeType: nodeType,
              folder: guessFolderFromNode(nodeType, filename)
            });
          }
        } else if (w && typeof w === 'object' && w.lora) {
          const loraName = String(w.lora).split(/[/\\]/).pop();
          extractedModels.push({
            name: loraName,
            nodeType: nodeType,
            folder: 'loras'
          });
        }
      });
    }
  });

  // Deduplicate and enrich with catalog metadata
  const deduplicatedMap = new Map();

  extractedModels.forEach(m => {
    if (!m.name) return; // BUG-4 guard: skip models without a name
    const key = m.name.toLowerCase();
    if (!deduplicatedMap.has(key)) {
      const matched = catalogMap.get(key) || {};
      deduplicatedMap.set(key, {
        id: 'mod_' + Math.random().toString(36).substring(2, 9),
        name: m.name,
        folder: normalizeModelFolder(matched.folder || m.folder || 'checkpoints'),
        url: matched.url || m.url || '',
        size: matched.size || 'Unknown',
        nodeType: m.nodeType,
        source: 'workflow'
      });
    }
  });

  return Array.from(deduplicatedMap.values());
}

export function parseTextDownloadList(text, catalog = []) {
  const lines = text.split('\n');
  const items = [];

  const catalogMap = new Map();
  catalog.forEach(item => {
    if (item.name) catalogMap.set(item.name.toLowerCase(), item);
  });

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const parts = trimmed.split(/\s+/);
    // BUG-3 fix: accept lines with just a URL (single token), default folder to checkpoints
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
  const type = (nodeType || '').toLowerCase();
  const file = (filename || '').toLowerCase();

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
