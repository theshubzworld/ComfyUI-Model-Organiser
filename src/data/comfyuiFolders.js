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
