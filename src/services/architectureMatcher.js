/**
 * ComfyUI Architecture Family Detection & Model Matcher Engine
 * Categorizes models and workflows into architecture families (LTX-Video, Wan 2.1, Flux.1, SDXL, SD1.5, Qwen, etc.)
 */

export const ARCHITECTURE_FAMILIES = [
  { id: 'all', name: '✨ All Architectures', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  { id: 'ltx-video', name: '🎥 LTX-Video (2.3)', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { id: 'wan21', name: '🎬 Wan 2.1 / 2.2', badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  { id: 'flux', name: '⚡ Flux.1 / Klein9B', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { id: 'sdxl', name: '🎨 SDXL / SDXL Turbo', badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  { id: 'sd15', name: '🖼️ SD 1.5 / AnimateDiff', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  { id: 'qwen', name: '🧠 Qwen Vision / LLM', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { id: 'hunyuan', name: '🐉 Hunyuan Video', badge: 'bg-teal-500/20 text-teal-300 border-teal-500/30' }
];

const toStr = (v) => (typeof v === 'string' ? v : v != null ? String(v) : '');

/**
 * Detect the architecture family of a model based on filename, node type, folder, or URL
 */
export function detectModelArchitecture(model) {
  if (!model) return 'other';

  const name = toStr(model.name || model.filename).toLowerCase();
  const url = toStr(model.url).toLowerCase();
  const folder = toStr(model.folder).toLowerCase();
  const nodeType = toStr(model.nodeType).toLowerCase();
  const text = `${name} ${url} ${folder} ${nodeType}`;

  if (text.includes('ltx') || text.includes('ltx-video') || text.includes('ltxv')) {
    return 'ltx-video';
  }
  if (text.includes('wan') || text.includes('wan2') || text.includes('wan_2') || text.includes('vace')) {
    return 'wan21';
  }
  if (text.includes('flux') || text.includes('schnell') || text.includes('klein') || text.includes('dev_fp8')) {
    return 'flux';
  }
  if (text.includes('sdxl') || text.includes('xl_base') || text.includes('xl_refiner') || text.includes('realism_sdxl')) {
    return 'sdxl';
  }
  if (text.includes('sd15') || text.includes('v1-5') || text.includes('animatediff') || text.includes('sd_v1')) {
    return 'sd15';
  }
  if (text.includes('qwen') || text.includes('qwenvision')) {
    return 'qwen';
  }
  if (text.includes('hunyuan') || text.includes('hyvid')) {
    return 'hunyuan';
  }

  return 'other';
}

/**
 * Detect the architecture family of a workflow based on workflow name and embedded models
 */
export function detectWorkflowArchitecture(workflow) {
  if (!workflow) return ['other'];

  const name = toStr(workflow.name).toLowerCase();
  const category = toStr(workflow.category).toLowerCase();
  const families = new Set();

  if (name.includes('ltx')) families.add('ltx-video');
  if (name.includes('wan')) families.add('wan21');
  if (name.includes('flux') || name.includes('klein')) families.add('flux');
  if (name.includes('sdxl') || name.includes('realism')) families.add('sdxl');
  if (name.includes('qwen')) families.add('qwen');
  if (name.includes('hunyuan')) families.add('hunyuan');

  // Also check embedded models in workflow
  if (Array.isArray(workflow.models)) {
    workflow.models.forEach(m => {
      const family = detectModelArchitecture(m);
      if (family !== 'other') families.add(family);
    });
  }

  return families.size ? Array.from(families) : ['sdxl'];
}

/**
 * Get all models from the full catalog that match the architecture families of the active selected workflows
 */
export function getSuggestedModelsForWorkflows(selectedWorkflows, allCatalogModels = []) {
  if (!selectedWorkflows || !selectedWorkflows.length) return [];

  // 1. Collect target architecture families from selected workflows
  const activeFamilies = new Set();
  selectedWorkflows.forEach(wf => {
    const families = detectWorkflowArchitecture(wf);
    families.forEach(f => activeFamilies.add(f));
  });

  // 2. Filter full catalog models matching any active family
  return allCatalogModels.filter(m => {
    const family = detectModelArchitecture(m);
    return activeFamilies.has(family) || activeFamilies.has('all');
  });
}
