// Canonical ComfyUI model directories. Values are relative to the `models/` root.
export const COMFYUI_MODEL_FOLDERS = [
  'AIFSH', 'BiRefNet', 'ControlNetModel', 'Kokorotts', 'LLM', 'OmniConsistency', 'RMBG', 'TheMisto_model',
  'animatediff_models', 'animatediff_motion_lora', 'annotator', 'apisr',
  'audio_encoders', 'blip', 'checkpoints', 'clip', 'clip_interrogator', 'clip_vision',
  'configs', 'controlnet', 'depthanything', 'diffusers', 'diffusion_models', 'dreamo', 'dz_facedetailer',
  'embeddings', 'face_parsing', 'face_restore', 'facedetection', 'facerestore_models', 'facexlib', 'florence2',
  'gligen', 'groundingdino', 'hyper_lora', 'hypernetworks',
  'inf-you', 'inpaint', 'insightface', 'instantid', 'instaswap', 'invsr',
  'ipadapter', 'ipadapter-flux', 'lama', 'latent_upscale_models', 'layer_model', 'liveportrait',
  'loras', 'luts', 'mmdets', 'model_patches', 'nsfw_detector', 'onnx', 'photomaker', 'prompt_generator', 'pulid',
  'reactor', 'rembg', 'sam', 'sam2', 'sams', 'style_models', 't5', 'text_encoders',
  'transparent-background', 'ultralytics', 'ultrapixel', 'unet', 'upscale_models', 'vae', 'vae_approx',
  'vitmatte', 'xlabs'
];

/** Accept either `folder` or `models/folder` without duplicating the models root. */
export function normalizeModelFolder(folder = 'checkpoints') {
  const normalized = String(folder)
    .trim()
    .replaceAll('\\', '/')
    .replace(/^models\//i, '')
    .replace(/^\/+|\/+$/g, '');

  // Older app versions used this non-standard name for the canonical LLM folder.
  if (normalized.toLowerCase() === 'llm_gguf') return 'LLM';

  return normalized || 'checkpoints';
}

export function guessFolderFromFilename(filename = '', defaultType = 'checkpoints') {
  const f = String(filename).toLowerCase().trim();
  
  // 1. VAE Models -> models/vae
  if (f.includes('vae') || f.endsWith('_ae.safetensors') || f.endsWith('_ae.pt')) {
    return 'vae';
  }
  
  // 2. LoRA / LoCon / DoRA -> models/loras
  if (f.includes('lora') || f.includes('locon') || f.includes('dora') || f.includes('slider')) {
    return 'loras';
  }
  
  // 3. Text Encoders / CLIP / T5 / Qwen -> models/clip
  if (
    f.includes('qwen') || f.includes('t5') || f.includes('t5xxl') || 
    f.includes('clip') || f.includes('text_encoder') || f.includes('text_encoders') ||
    f.includes('umt5') || f.includes('openclip')
  ) {
    return 'clip';
  }
  
  // 4. ControlNet / Depth -> models/controlnet
  if (f.includes('controlnet') || f.includes('control') || f.includes('depthanything')) {
    return 'controlnet';
  }
  
  // 5. Upscale Models -> models/upscale_models
  if (f.includes('upscale') || f.includes('esrgan') || f.includes('spandrel') || f.includes('realesrgan')) {
    return 'upscale_models';
  }
  
  // 6. GGUF Models
  if (f.endsWith('.gguf') || f.includes('gguf')) {
    // If it's a UNet/Transformer GGUF (flux, wan, ltx, hunyuan, unet, diffusion, sdxl, sd3) -> unet
    if (
      f.includes('flux') || f.includes('wan') || f.includes('ltx') || 
      f.includes('hunyuan') || f.includes('cogvideo') || f.includes('unet') || 
      f.includes('diffusion') || f.includes('transformer') || f.includes('sdxl') || f.includes('sd3')
    ) {
      return 'unet';
    }
    // Text Encoder or LLM GGUF -> LLM
    if (f.includes('llama') || f.includes('mistral') || f.includes('gemma') || f.includes('llm') || f.includes('qwen')) {
      return 'LLM';
    }
    return 'unet';
  }
  
  // 7. Split Transformer / Diffusion Models / UNet -> models/diffusion_models
  if (
    f.includes('klein') || f.includes('flux') || f.includes('ltx') || 
    f.includes('wan2') || f.includes('wan_2') || f.includes('wan') || 
    f.includes('hunyuan') || f.includes('cogvideo') || f.includes('mochi') || 
    f.includes('lumina') || f.includes('pixart') || f.includes('auraflow') || 
    f.includes('transformer') || f.includes('diffusion') || f.includes('unet')
  ) {
    return 'diffusion_models';
  }

  // 8. Full All-in-One Checkpoints
  if (
    f.includes('checkpoint') || f.includes('sdxl') || f.includes('sd_1') || 
    f.includes('sd1.5') || f.includes('sd15') || f.includes('pony') || 
    f.includes('illustrious') || f.includes('noobai') || f.includes('realism')
  ) {
    return 'checkpoints';
  }

  return normalizeModelFolder(defaultType);
}
