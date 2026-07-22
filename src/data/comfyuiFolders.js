// Canonical ComfyUI model directories. Values are relative to the `models/` root.
export const COMFYUI_MODEL_FOLDERS = [
  'BiRefNet', 'ControlNetModel', 'Kokorotts', 'LLM', 'OmniConsistency', 'RMBG', 'TheMisto_model',
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
  const def = normalizeModelFolder(defaultType);
  
  // 1. VAE Models -> models/vae
  if (f.includes('vae') || f.endsWith('_ae.safetensors') || f.endsWith('_ae.pt') || f === 'ae.safetensors') {
    return 'vae';
  }
  
  // 2. LoRA / LoCon / DoRA -> models/loras
  // BUG FIX: 'lightning' only matches loras when filename also contains lora-like keywords,
  // NOT when it's a checkpoint like 'realvisxlV40_v40LightningBakedvae'
  if (f.includes('lora') || f.includes('locon') || f.includes('dora') || f.includes('slider')) {
    return 'loras';
  }
  // Lightning LoRA: must have 'lightning' AND a lora-indicating keyword
  if (f.includes('lightning') && (f.includes('lora') || f.includes('step') || f.includes('rank'))) {
    return 'loras';
  }

  // 3. ControlNet / Depth / Pose -> models/controlnet
  if (f.includes('controlnet') || f.includes('control') || f.includes('depthanything') || f.includes('openpose')) {
    return 'controlnet';
  }

  // 4. ONNX / Object Detection / Face Parsing / SAM -> models/sams or models/detection
  if (f.endsWith('.onnx') || f.includes('yolo') || f.includes('vitpose') || f.includes('torchscript') || f.includes('insightface')) {
    return f.includes('insightface') ? 'insightface' : 'sams';
  }
  
  // 5. IP-Adapter -> models/ipadapter
  if (f.includes('ip-adapter') || f.includes('ip_adapter') || f.includes('ipadapter')) {
    return 'ipadapter';
  }

  // 6. Upscale Models -> models/upscale_models
  if (f.includes('upscale') || f.includes('esrgan') || f.includes('spandrel') || f.includes('realesrgan')) {
    return 'upscale_models';
  }
  
  // 6. GGUF Models -> models/unet or models/LLM
  if (f.endsWith('.gguf') || f.includes('gguf')) {
    // UNet/Transformer GGUF (flux, wan, ltx, hunyuan, unet, diffusion, sdxl, sd3, qwen-image) -> unet
    if (
      f.includes('flux') || f.includes('wan') || f.includes('ltx') || 
      f.includes('hunyuan') || f.includes('cogvideo') || f.includes('unet') || 
      f.includes('diffusion') || f.includes('transformer') || f.includes('sdxl') || 
      f.includes('sd3') || f.includes('qwen-image') || f.includes('qwen_image')
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
    f.includes('transformer') || f.includes('diffusion') || f.includes('unet') ||
    f.includes('qwen_image_') || f.includes('qwen-image-') || f.includes('edit_')
  ) {
    return 'diffusion_models';
  }

  // 8. Text Encoders / CLIP / T5 / Gemma / Qwen VL Text Encoders -> models/clip
  if (
    f.includes('clip') || f.includes('t5') || f.includes('t5xxl') || 
    f.includes('text_encoder') || f.includes('text_encoders') ||
    f.includes('umt5') || f.includes('openclip') || f.includes('sigclip') || 
    f.includes('siglip') || f.includes('gemma') || f.includes('qwen_2.5_vl') || 
    f.includes('qwen_3_8b') || f.includes('qwen_3_4b') || f.includes('qwen_0.6b') || 
    f.includes('qwen_1.7b') || f.includes('qwen3vl') || f.includes('qwenvision')
  ) {
    return 'clip';
  }

  // 9. Full All-in-One Checkpoints
  if (
    f.includes('checkpoint') || f.includes('sdxl') || f.includes('sd_1') || 
    f.includes('sd1.5') || f.includes('sd15') || f.includes('pony') || 
    f.includes('illustrious') || f.includes('noobai') || f.includes('realism')
  ) {
    return 'checkpoints';
  }

  // 10. Default fallback: trust nodeType/defaultType if specific
  return def !== 'checkpoints' ? def : 'checkpoints';
}
