/**
 * Client-side ComfyUI JSON Workflow Parser & Link Extraction Engine
 */
import { normalizeModelFolder, guessFolderFromFilename } from '../data/comfyuiFolders';

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
  const validExtensions = ['.safetensors', '.pth', '.gguf', '.ckpt', '.bin', '.onnx', '.pt', '.sft', '.zip'];
  const ignoredExtensions = ['.mp4', '.webm', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.mov', '.avi', '.mkv', '.mp3', '.wav', '.flac', '.ogg', '.m4a', '.txt', '.json', '.html', '.css', '.js', '.py'];
  const ignoredNodeTypes = [
    'vhs_videocombine', 'vhs_loadvideo', 'loadvideo', 'savevideo', 'loadimage', 
    'saveimage', 'previewimage', 'vhs_loadimages', 'vhs_loadimagespath', 
    'saveimagewebp', 'animatedpng', 'note', 'markdown', 'displaytext'
  ];

  const isMediaNode = (type) => {
    const t = toStr(type).toLowerCase();
    return ignoredNodeTypes.some(ignored => t.includes(ignored));
  };

  const isModelFileOrUrl = (url, filename) => {
    const urlLower = toStr(url).toLowerCase();
    const fileLower = toStr(filename).toLowerCase();

    // 1. Exclude ignored media / code / document extensions
    if (ignoredExtensions.some(ext => fileLower.endsWith(ext) || urlLower.split('?')[0].endsWith(ext))) {
      return false;
    }

    // 2. Accept CivitAI & HuggingFace model download endpoints
    if (urlLower.includes('civitai.com/api/download/models') || urlLower.includes('civitai.red') || (urlLower.includes('huggingface.co') && urlLower.includes('/resolve/'))) {
      return true;
    }

    // 3. Accept valid AI model file extensions
    if (validExtensions.some(ext => fileLower.endsWith(ext) || urlLower.split('?')[0].endsWith(ext))) {
      return true;
    }

    return false;
  };

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
    const typeStr = toStr(nodeType).toLowerCase();
    
    // 0. Skip media output / video / image nodes (DO NOT skip notes!)
    const mediaNodes = [
      'vhs_videocombine', 'vhs_loadvideo', 'loadvideo', 'savevideo', 'loadimage', 
      'saveimage', 'previewimage', 'vhs_loadimages', 'vhs_loadimagespath', 
      'saveimagewebp', 'animatedpng'
    ];
    if (mediaNodes.some(m => typeStr.includes(m))) return;

    // Extract all raw string text inside widgets_values, inputs, or properties
    const textValues = [];
    const extractStrings = (obj) => {
      if (!obj) return;
      if (typeof obj === 'string') textValues.push(obj);
      else if (Array.isArray(obj)) obj.forEach(extractStrings);
      else if (typeof obj === 'object') Object.values(obj).forEach(extractStrings);
    };
    extractStrings(inputsOrWidgets);
    if (properties && properties.text) extractStrings(properties.text);
    if (properties && properties.models) extractStrings(properties.models);

    const fullTextContent = textValues.join('\n');

    // -----------------------------------------------------------------
    // TYPE 1: Markdown Note Node ("Model: ... Output folder: ...")
    // -----------------------------------------------------------------
    if (typeStr.includes('note') || typeStr.includes('markdown') || typeStr.includes('displaytext') || fullTextContent.includes('Output folder') || fullTextContent.includes('output folder')) {
      const lines = fullTextContent.split(/\r?\n/);

      // Strip markdown formatting chars from a line so we can parse the semantic content
      // Handles: `backtick code`, **bold**, *italic*, ### headings, __underline__
      const stripMd = (s) => s
        .replace(/`([^`]*)`/g, '$1')   // `code` → code
        .replace(/\*\*/g, '')          // **bold**
        .replace(/__/g, '')            // __underline__
        .replace(/^#+\s*/, '')         // ### heading
        .replace(/\*/g, '')            // *italic*
        .trim();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        let url = '';
        let filename = '';
        let folder = '';

        // Match Markdown link: [ModelName](https://url)  — use RAW line (link syntax must stay intact)
        const mdMatch = line.match(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/i);
        if (mdMatch) {
          filename = mdMatch[1].trim();
          url = mdMatch[2].trim();
        } else {
          const urlMatch = line.match(/(https?:\/\/[^\s"'\)]+)/i);
          if (urlMatch) url = urlMatch[1].trim();

          // Strip markdown first so "### Model:" and "**Model:**" both parse correctly
          const cleanLine = stripMd(line);
          const modelMatch = cleanLine.match(/(?:Model|File)\s*:\s*([^\s"'*#<>]+)/i);
          if (modelMatch) filename = modelMatch[1].trim();
        }

        if (url || filename) {
          // Look ahead up to 6 lines for "Output folder:" label + path
          for (let j = i + 1; j <= Math.min(i + 6, lines.length - 1); j++) {
            const rawNext = lines[j].trim();
            if (!rawNext) continue;

            const cleanNext = stripMd(rawNext); // strip **, backticks, etc.

            // Case A: "Output folder: path/here" — label AND path on same line (after stripping)
            const sameLine = cleanNext.match(/(?:Output\s+folder|folder)\s*:\s*(.+)/i);
            if (sameLine) {
              const rawPath = sameLine[1].trim();
              if (rawPath && !/^\*+$/.test(rawPath)) {
                // Actual path content — strip Windows prefix
                folder = rawPath.replace(/\\/g, '/').replace(/^.*?models\//i, '');
                break;
              } else {
                // Case B: "Output folder:" alone (or only had ** after stripping)
                // Path is on the VERY NEXT non-empty line
                for (let k = j + 1; k <= Math.min(j + 2, lines.length - 1); k++) {
                  const rawPath2 = stripMd(lines[k].trim());
                  if (!rawPath2) continue;
                  // Accept if it contains a path separator or starts with a known folder name
                  if (/[/\\]/.test(rawPath2) || /^(loras|checkpoints|unet|controlnet|vae|clip|ipadapter|diffusion_models|text_encoders|upscale_models|sams|LLM|animatediff|App)/i.test(rawPath2)) {
                    folder = rawPath2.replace(/\\/g, '/').replace(/^.*?models\//i, '');
                    break;
                  }
                }
                break;
              }
            }

            // Case C: bare path line (after stripping) starting with App\ComfyUI\models\ or models\
            const pathMatch = cleanNext.match(/(?:App[/\\]ComfyUI[/\\]models[/\\]|models[/\\])(.+)/i);
            if (pathMatch) {
              folder = pathMatch[1].replace(/\\/g, '/');
              break;
            }
          }

          if (!filename && url) filename = getFilenameFromUrl(url);

          if ((url || filename) && isModelFileOrUrl(url, filename)) {
            // Explicit folder from the note always wins over filename guessing
            const resolvedFolder = folder
              ? normalizeModelFolder(folder)
              : guessFolderFromFilename(filename, 'checkpoints');

            results.push({
              name: filename,
              url: url,
              folder: resolvedFolder,
              explicitFolder: Boolean(folder),
              nodeType: 'Markdown Note'
            });
          }
        }
      }
      return;
    }


    // -----------------------------------------------------------------
    // TYPE 2: Downloader Node (multi-line "URL folder custom_filename")
    // -----------------------------------------------------------------
    if (fullTextContent.includes('http') && fullTextContent.includes('\n')) {
      const lines = fullTextContent.split(/\r?\n/);
      let parsedAnyDownloaderLine = false;

      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return;

        const parts = trimmed.split(/\s+/);
        if (parts.length >= 1 && parts[0].startsWith('http')) {
          parsedAnyDownloaderLine = true;
          const url = parts[0];
          const secondPart = parts[1] || '';
          const thirdPart = parts[2] || '';

          let folder = '';
          let filename = thirdPart;

          if (secondPart) {
            const cleanPath = secondPart.replace(/\\/g, '/');
            if (cleanPath.startsWith('models/')) {
              const pathSegments = cleanPath.replace(/^models\//, '').split('/');
              folder = pathSegments[0];
              const lastSegment = pathSegments[pathSegments.length - 1];
              if (!filename && /\.(safetensors|pth|pt|bin|gguf|onnx|ckpt|sft|zip)$/i.test(lastSegment)) {
                filename = lastSegment;
                folder = pathSegments.slice(0, -1).join('/');
              } else if (pathSegments.length > 1) {
                folder = pathSegments.join('/');
              }
            } else if (cleanPath.includes('/')) {
              const pathSegments = cleanPath.split('/');
              const lastSegment = pathSegments[pathSegments.length - 1];
              if (!filename && /\.(safetensors|pth|pt|bin|gguf|onnx|ckpt|sft|zip)$/i.test(lastSegment)) {
                filename = lastSegment;
                folder = pathSegments.slice(0, -1).join('/');
              } else {
                folder = cleanPath;
              }
            } else {
              folder = secondPart;
            }
          }

          if (!filename) filename = getFilenameFromUrl(url);

          if (isModelFileOrUrl(url, filename)) {
            // BUG FIX: If the line explicitly provides a folder, ALWAYS trust it.
            // Only fall back to guessFolderFromFilename when no folder was given.
            const resolvedFolder = folder
              ? normalizeModelFolder(folder)
              : guessFolderFromFilename(filename, 'checkpoints');

            results.push({
              name: filename,
              url: url,
              folder: resolvedFolder,
              explicitFolder: Boolean(folder), // flag so deduplication respects it
              nodeType: toStr(nodeType) || 'Downloader Node'
            });
          }
        }
      });

      if (parsedAnyDownloaderLine) return;
    }

    // -----------------------------------------------------------------
    // TYPE 3: Standard ComfyUI Model Loader Node
    // -----------------------------------------------------------------
    const scanValue = (val, keyHint = '') => {
      if (!val) return;
      if (typeof val === 'string') {
        const matches = val.match(urlRegex);
        if (matches) {
          matches.forEach(rawUrl => {
            const cleanUrl = rawUrl.replace(/[,\)"']+$/, '');
            const filename = getFilenameFromUrl(cleanUrl);
            if (isModelFileOrUrl(cleanUrl, filename)) {
              results.push({
                name: filename,
                url: cleanUrl,
                folder: guessFolderFromNode(nodeType || keyHint, filename),
                nodeType: toStr(nodeType) || 'Downloader Node'
              });
            }
          });
        } else {
          const lower = val.toLowerCase();
          if (validExtensions.some(ext => lower.endsWith(ext)) && !ignoredExtensions.some(ext => lower.endsWith(ext))) {
            // Take only the filename (last segment) — subfolders don't matter per user rule
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
        // val.lora may contain "subfolder\filename" — extract just the filename (last segment)
        const rawLora = toStr(val.lora || '');
        const rawName = rawLora
          ? rawLora.split(/[/\\]/).pop()
          : toStr(val.name || val.filename || val.model_name);
        const rawFolder = toStr(val.folder || val.directory || '');

        if (rawUrl || rawName) {
          const url = rawUrl;
          const name = rawName || getFilenameFromUrl(url);
          if ((name || url) && isModelFileOrUrl(url, name)) {
            const folder = rawFolder
              ? normalizeModelFolder(rawFolder)
              : guessFolderFromNode(nodeType, name);
            results.push({
              name: name,
              url: url,
              folder: folder,
              explicitFolder: Boolean(rawFolder),
              nodeType: toStr(nodeType) || 'Downloader Node'
            });
          }
        }
      }
    };

    if (Array.isArray(inputsOrWidgets)) inputsOrWidgets.forEach(w => scanValue(w));
    else if (inputsOrWidgets && typeof inputsOrWidgets === 'object') Object.entries(inputsOrWidgets).forEach(([k, v]) => scanValue(v, k));
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

  // -------------------------------------------------------------
  // Smart Deduplication & URL-to-Filename Cross Matching Engine
  // -------------------------------------------------------------
  const urlMap = new Map(); // filename -> url
  const itemsWithUrls = [];
  const itemsWithoutUrls = [];

  results.forEach(r => {
    const urlStr = toStr(r.url);
    const nameStr = toStr(r.name);
    const nameLower = nameStr.toLowerCase();

    // Guard: ignore media files
    if (ignoredExtensions.some(ext => nameLower.endsWith(ext) || urlStr.split('?')[0].toLowerCase().endsWith(ext))) {
      return;
    }

    if (urlStr) {
      const urlFileName = getFilenameFromUrl(urlStr).toLowerCase();
      if (urlFileName) {
        urlMap.set(urlFileName, urlStr);
        const baseName = urlFileName.replace(/\.(safetensors|ckpt|pth|gguf|bin|pt|onnx|sft)$/i, '');
        if (baseName && baseName.length >= 3) {
          urlMap.set(baseName, urlStr);
        }
      }
      itemsWithUrls.push({ ...r, url: urlStr, name: nameStr || getFilenameFromUrl(urlStr) });
    } else {
      itemsWithoutUrls.push({ ...r, name: nameStr });
    }
  });

  const finalMap = new Map();

  // Pass 1: Process all items that HAVE URLs
  itemsWithUrls.forEach(item => {
    const urlFileName = getFilenameFromUrl(item.url) || item.name;
    const nameKey = (urlFileName || item.name || item.url).toLowerCase();
    
    // BUG FIX: Preserve explicit folder — do NOT re-run guessFolderFromNode which would override it.
    const resolvedFolder = item.explicitFolder
      ? item.folder
      : guessFolderFromNode(item.nodeType, urlFileName || item.name, item.folder);

    if (!finalMap.has(nameKey)) {
      finalMap.set(nameKey, {
        id: 'extracted_' + Math.random().toString(36).substring(2, 9),
        name: item.name && item.name !== urlFileName ? item.name : urlFileName,
        url: item.url,
        folder: resolvedFolder,
        nodeType: toStr(item.nodeType) || 'Downloader Node',
        size: 'Unknown'
      });
    } else {
      const existing = finalMap.get(nameKey);
      // If new item has an explicit folder, update the folder
      if (item.explicitFolder) existing.folder = resolvedFolder;
      if (item.nodeType && !existing.nodeType.includes(item.nodeType)) {
        existing.nodeType += ` / ${item.nodeType}`;
      }
    }
  });

  // Pass 2: Process items WITHOUT URLs and smartly cross-match Hugging Face filenames
  itemsWithoutUrls.forEach(item => {
    const rawName = toStr(item.name);
    const nameLower = rawName.toLowerCase();
    const baseName = nameLower.replace(/\.(safetensors|ckpt|pth|gguf|bin|pt|onnx|sft)$/i, '');

    let matchedUrl = urlMap.get(nameLower) || urlMap.get(baseName);

    if (!matchedUrl) {
      for (const [key, existing] of finalMap.entries()) {
        if (key.includes(nameLower) || key.includes(baseName) || nameLower.includes(key) || (baseName && key.includes(baseName))) {
          matchedUrl = existing.url;
          if (item.nodeType && !existing.nodeType.includes(item.nodeType)) {
            existing.nodeType += ` / ${item.nodeType}`;
          }
          break;
        }
      }
    }

    if (matchedUrl) {
      const urlFileName = getFilenameFromUrl(matchedUrl) || rawName;
      const key = urlFileName.toLowerCase();
      if (finalMap.has(key)) {
        const existing = finalMap.get(key);
        if (item.nodeType && !existing.nodeType.includes(item.nodeType)) {
          existing.nodeType += ` / ${item.nodeType}`;
        }
      } else {
        finalMap.set(key, {
          id: 'extracted_' + Math.random().toString(36).substring(2, 9),
          name: urlFileName || rawName,
          url: matchedUrl,
          folder: guessFolderFromNode(item.nodeType, rawName, item.folder),
          nodeType: toStr(item.nodeType) || 'Loader Node',
          size: 'Unknown'
        });
      }
    } else {
      // Standalone loader node without a downloader node in the same JSON
      const key = nameLower;
      if (!finalMap.has(key)) {
        finalMap.set(key, {
          id: 'extracted_' + Math.random().toString(36).substring(2, 9),
          name: rawName || 'unnamed_model',
          url: '',
          folder: guessFolderFromNode(item.nodeType, rawName, item.folder),
          nodeType: toStr(item.nodeType) || 'Loader Node',
          size: 'Unknown'
        });
      }
    }
  });

  return Array.from(finalMap.values());
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
    const finalFolder = guessFolderFromNode(m.nodeType, m.name || matched.name, m.folder || matched.folder);

    return {
      ...m,
      name: m.name || matched.name || 'unnamed_model',
      url: mUrl || toStr(matched.url),
      size: m.size && m.size !== 'Unknown' ? m.size : (toStr(matched.size) || 'Unknown'),
      folder: normalizeModelFolder(finalFolder),
      source: 'workflow'
    };
  });
}

export function parseTextDownloadList(text, catalog = []) {
  const lines = toStr(text).split('\n');
  const items = [];

  // Build catalog lookup maps by URL and version ID
  const urlCatalogMap = new Map();
  const versionCatalogMap = new Map();
  (catalog || []).forEach(m => {
    if (m.url) {
      const cleanUrl = m.url.split('?')[0].toLowerCase();
      urlCatalogMap.set(cleanUrl, m);
      const match = m.url.match(/\/models\/(\d+)/);
      if (match) versionCatalogMap.set(match[1], m);
    }
  });

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return;

    const parts = trimmed.split(/\s+/);
    if (parts.length >= 1 && parts[0].startsWith('http')) {
      const url = parts[0];
      const secondPart = parts[1] || '';
      const thirdPart = parts[2] || '';

      let explicitFolder = '';
      let filename = thirdPart;

      if (secondPart) {
        const cleanPath = secondPart.replace(/\\/g, '/');
        const pathSegments = cleanPath.replace(/^models\//, '').split('/');
        const lastSegment = pathSegments[pathSegments.length - 1];

        if (/\.(safetensors|pth|pt|bin|gguf|onnx|ckpt|sft|zip)$/i.test(lastSegment)) {
          filename = lastSegment;
          if (pathSegments.length > 1) {
            explicitFolder = pathSegments.slice(0, -1).join('/');
          }
        } else {
          explicitFolder = cleanPath;
        }
      }

      // If filename is not specified on line, check catalog or format generic CivitAI ID name
      if (!filename) {
        const cleanUrl = url.split('?')[0].toLowerCase();
        const vMatch = url.match(/\/models\/(\d+)/);
        const versionId = vMatch ? vMatch[1] : '';

        const catMatch = urlCatalogMap.get(cleanUrl) || (versionId ? versionCatalogMap.get(versionId) : null);
        if (catMatch && catMatch.name) {
          filename = catMatch.name;
        } else if (url.includes('civitai.com') || url.includes('civitai.red')) {
          filename = versionId ? `civitai_${versionId}` : 'civitai_model.safetensors';
        } else {
          const urlLast = url.split('/').pop().split('?')[0];
          filename = urlLast || 'model.safetensors';
        }
      }

      // Folder resolution: explicit folder > guess from filename
      const finalFolder = explicitFolder
        ? normalizeModelFolder(explicitFolder)
        : guessFolderFromFilename(filename, 'checkpoints');

      items.push({
        id: 'mod_' + Math.random().toString(36).substring(2, 9),
        name: filename,
        folder: finalFolder,
        url: url,
        size: 'Unknown',
        source: 'text_import'
      });
    }
  });

  return items;
}

export function guessFolderFromNode(nodeType, filename, rawFolder = '') {
  const type = toStr(nodeType).toLowerCase();
  const file = toStr(filename).toLowerCase();

  let defaultType = 'checkpoints';
  if (type.includes('vae') || file.includes('vae')) defaultType = 'vae';
  else if (type.includes('clip') || type.includes('text') || file.includes('clip') || file.includes('t5') || file.includes('text_encoder')) defaultType = 'clip';
  else if (type.includes('lora') || file.includes('lora')) defaultType = 'loras';
  else if (type.includes('unet') || type.includes('diffusion') || file.includes('unet') || file.includes('diffusion')) defaultType = 'diffusion_models';
  else if (type.includes('controlnet') || file.includes('controlnet')) defaultType = 'controlnet';
  else if (type.includes('ipadapter') || file.includes('ipadapter') || file.includes('ip-adapter')) defaultType = 'ipadapter';
  else if (type.includes('llm') || file.includes('mistral')) defaultType = 'LLM';
  else if (type.includes('depth') || type.includes('preprocessor') || file.endsWith('.pth')) defaultType = 'sams';
  else if (rawFolder) defaultType = rawFolder;

  return guessFolderFromFilename(filename, defaultType);
}
