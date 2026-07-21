import os
import json
import re

WORKFLOWS_DIR = r"d:\AI GENRATION\LAB\SIMPLEPOD SECRET\MODEL SIZE CALCULATOR\workflows"
DOWNLOAD_TXT = r"d:\AI GENRATION\LAB\SIMPLEPOD SECRET\MODEL SIZE CALCULATOR\download.txt"
MODEL_LIST_TXT = r"d:\AI GENRATION\LAB\SIMPLEPOD SECRET\MODEL SIZE CALCULATOR\model-list.txt"

# Comprehensive Master Catalog of AI Model URLs & ComfyUI Target Folders
MASTER_URL_MAP = {
    # Checkpoints / Diffusion UNet
    "flux1-dev-fp8.safetensors": ("https://huggingface.co/lllyasviel/flux1_dev/resolve/main/flux1-dev-fp8.safetensors", "unet"),
    "realism-sdxl.safetensors": ("https://huggingface.co/comfyuistudio/realism-sdxl/resolve/main/realism-sdxl.safetensors", "checkpoints"),
    "realvisxlV40_v40LightningBakedvae.safetensors": ("https://huggingface.co/alexgenovese/reica_models/resolve/021e192bd744c48a85f8ae1832662e77beb9aac7/realvisxlV40_v40LightningBakedvae.safetensors", "checkpoints"),
    "mopMixtureOfPerverts_v61DMD.safetensors": ("https://huggingface.co/badgame/FluxRealSkin/resolve/main/mopMixtureOfPerverts_v61DMD.safetensors", "checkpoints"),
    "mopMixtureOfPerverts_v51DMD.safetensors": ("https://huggingface.co/badgame/FluxRealSkin/resolve/main/mopMixtureOfPerverts_v51DMD.safetensors", "checkpoints"),
    "qwreal.safetensors": ("https://huggingface.co/comfyuistudio/qwreal/resolve/main/qwreal.safetensors", "unet"),
    "Qwen-Image-Edit-2511-FP8_e4m3fn.safetensors": ("https://huggingface.co/1038lab/Qwen-Image-Edit-2511-FP8/resolve/main/Qwen-Image-Edit-2511-FP8_e4m3fn.safetensors", "diffusion_models"),
    "qwen_image_edit_2509_fp8_e4m3fn.safetensors": ("https://huggingface.co/Comfy-Org/Qwen-Image-Edit_ComfyUI/resolve/main/split_files/diffusion_models/qwen_image_edit_2509_fp8_e4m3fn.safetensors", "diffusion_models"),
    
    # Text Encoders / CLIP
    "clip_l.safetensors": ("https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors", "clip"),
    "t5xxl_fp8_e4m3fn.safetensors": ("https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn.safetensors", "clip"),
    "qwen_2.5_vl_7b_fp8_scaled.safetensors": ("https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors", "clip"),
    "clip_vision_h.safetensors": ("https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/clip_vision/clip_vision_h.safetensors", "clip_vision"),

    # VAE
    "flux_vae.safetensors": ("https://huggingface.co/StableDiffusionVN/Flux/resolve/main/Vae/flux_vae.safetensors", "vae"),
    "qwen_image_vae.safetensors": ("https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors", "vae"),
    "vae-ft-mse-840000-ema-pruned.safetensors": ("https://huggingface.co/stabilityai/sd-vae-ft-mse-original/resolve/main/vae-ft-mse-840000-ema-pruned.safetensors", "vae"),

    # LoRAs
    "Qwen-Image-Lightning-4steps-V1.0.safetensors": ("https://huggingface.co/lightx2v/Qwen-Image-Lightning/resolve/main/Qwen-Image-Lightning-4steps-V1.0.safetensors", "loras"),
    "qwen-image-edit-2511-multiple-angles-lora.safetensors": ("https://huggingface.co/fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA/resolve/main/qwen-image-edit-2511-multiple-angles-lora.safetensors", "loras"),
    "Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors": ("https://huggingface.co/lightx2v/Qwen-Image-Edit-2511-Lightning/resolve/main/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors", "loras"),

    # ControlNet & IP-Adapter
    "diffusion_pytorch_model_promax.safetensors": ("https://huggingface.co/xinsir/controlnet-union-sdxl-1.0/resolve/main/diffusion_pytorch_model_promax.safetensors", "controlnet controlnet-union-sdxl-1.0.safetensors"),
    "FLUX.1-dev-ControlNet-Union-Pro-2.0.safetensors": ("https://huggingface.co/Shakker-Labs/FLUX.1-dev-ControlNet-Union-Pro-2.0/resolve/main/diffusion_pytorch_model.safetensors", "controlnet FLUX.1-dev-ControlNet-Union-Pro-2.0.safetensors"),
    "Qwen-Image-InstantX-ControlNet-Union.safetensors": ("https://huggingface.co/Comfy-Org/Qwen-Image-InstantX-ControlNets/resolve/main/split_files/controlnet/Qwen-Image-InstantX-ControlNet-Union.safetensors", "controlnet"),
    "ip-adapter-plus_sdxl_vit-h.safetensors": ("https://huggingface.co/h94/IP-Adapter/resolve/main/sdxl_models/ip-adapter-plus_sdxl_vit-h.safetensors", "ipadapter"),
    "ip-adapter_sdxl_vit-h.safetensors": ("https://huggingface.co/h94/IP-Adapter/resolve/main/sdxl_models/ip-adapter_sdxl_vit-h.safetensors", "ipadapter"),
    "fooocus_inpaint_head.pth": ("https://huggingface.co/lllyasviel/fooocus_inpaint/resolve/main/fooocus_inpaint_head.pth", "inpaint"),

    # LLM & Preprocessors / SAM / Florence
    "Mistral-7B-Instruct-v0.3.Q4_K_M.gguf": ("https://huggingface.co/MaziyarPanahi/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3.Q4_K_M.gguf", "llm_gguf"),
    "sam_vit_b_01ec64.pth": ("https://huggingface.co/comfyuistudio/sam_vit_b_01ec64.pth/resolve/main/sam_vit_b_01ec64.pth", "sams"),
    "sam2_hiera_base_plus.safetensors": ("https://huggingface.co/facebook/sam2-hiera-base-plus/resolve/main/sam2_hiera_base_plus.safetensors", "sams"),
    "yolox_l.onnx": ("https://huggingface.co/yustc/onnxwdet/resolve/main/yolox_l.onnx", "sams"),
    "depth_anything_v2_vitl.pth": ("https://huggingface.co/depth-anything/Depth-Anything-V2-Large/resolve/main/depth_anything_v2_vitl.pth", "sams"),
    "depth_anything_vitl14.pth": ("https://huggingface.co/LiheYoung/depth_anything_vitl14/resolve/main/depth_anything_vitl14.pth", "sams"),
    "dw-ll_ucoco_384_bs5.torchscript.pt": ("https://huggingface.co/yustc/onnxwdet/resolve/main/dw-ll_ucoco_384_bs5.torchscript.pt", "sams"),
    "4x_foolhardy_Remacri.pth": ("https://huggingface.co/FacehugmanIII/4x_foolhardy_Remacri/resolve/main/4x_foolhardy_Remacri.pth", "upscale_models"),
}

existing_lines_map = {}

if os.path.exists(DOWNLOAD_TXT):
    with open(DOWNLOAD_TXT, "r", encoding="utf-8") as f:
        for line in f:
            l = line.strip()
            if l and not l.startswith("#"):
                parts = l.split()
                if len(parts) >= 2:
                    url = parts[0]
                    folder = parts[1]
                    name = parts[2] if len(parts) > 2 else os.path.basename(url)
                    existing_lines_map[name] = (url, folder)
                    existing_lines_map[os.path.basename(url)] = (url, folder)

workflow_model_extracts = {}

for root, dirs, files in os.walk(WORKFLOWS_DIR):
    for file in files:
        if file.endswith(".json"):
            wf_name = os.path.splitext(file)[0]
            filepath = os.path.join(root, file)
            
            try:
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    data = json.load(f)
                
                nodes = data.get("nodes", [])
                models_found = []

                for node in nodes:
                    widgets = node.get("widgets_values", [])
                    props = node.get("properties", {})
                    
                    if "models" in props and isinstance(props["models"], list):
                        for m in props["models"]:
                            if m.get("name") and m.get("url"):
                                models_found.append((m.get("name"), m.get("url"), m.get("directory", "checkpoints")))
                    
                    if isinstance(widgets, list):
                        for w in widgets:
                            if isinstance(w, str) and any(w.endswith(ext) for ext in [".safetensors", ".pth", ".gguf", ".ckpt", ".bin", ".onnx", ".pt"]):
                                fname = os.path.basename(w)
                                url_info = MASTER_URL_MAP.get(fname) or existing_lines_map.get(fname)
                                if url_info:
                                    models_found.append((fname, url_info[0], url_info[1]))
                                else:
                                    models_found.append((fname, f"https://huggingface.co/search?q={fname}", "checkpoints"))

                workflow_model_extracts[wf_name] = models_found
            except Exception as e:
                pass

new_download_content = []
new_download_content.append("# ========================================================")
new_download_content.append("# SIMPLEPOD MASTER COMFYUI MODEL DOWNLOAD LIST")
new_download_content.append("# Auto-generated from all workflow JSONs & preprocessor models")
new_download_content.append("# ========================================================\n")

seen_global_urls = set()

for wf_name, models in workflow_model_extracts.items():
    if not models:
        continue
    
    new_download_content.append(f"#{wf_name.upper()}")
    wf_added = False
    for fname, url, folder in models:
        if url in seen_global_urls:
            continue
        seen_global_urls.add(url)
        wf_added = True
        if " " in folder:
            new_download_content.append(f"{url} {folder}")
        elif fname and fname != os.path.basename(url):
            new_download_content.append(f"{url} {folder} {fname}")
        else:
            new_download_content.append(f"{url} {folder}")
    if wf_added:
        new_download_content.append("")

# Ingest external models.txt and civitai_download.txt
MODELS_TXT = r"d:\AI GENRATION\LAB\SIMPLEPOD SECRET\MODEL SIZE CALCULATOR\models.txt"
CIVITAI_TXT = r"d:\AI GENRATION\LAB\SIMPLEPOD SECRET\MODEL SIZE CALCULATOR\civitai_download.txt"

external_links = []
for ext_path, section_title in [(MODELS_TXT, "MODELS.TXT LINKS"), (CIVITAI_TXT, "CIVITAI DOWNLOAD LINKS")]:
    if os.path.exists(ext_path):
        with open(ext_path, "r", encoding="utf-8") as f:
            lines = [l.strip() for l in f if l.strip() and not l.strip().startswith("#")]
        if lines:
            new_download_content.append(f"#{section_title}")
            for l in lines:
                parts = l.split()
                if parts:
                    url = parts[0]
                    if url not in seen_global_urls:
                        seen_global_urls.add(url)
                        new_download_content.append(l)
            new_download_content.append("")

with open(DOWNLOAD_TXT, "w", encoding="utf-8") as f:
    f.write("\n".join(new_download_content))

with open(MODEL_LIST_TXT, "w", encoding="utf-8") as f:
    f.write("\n".join(new_download_content))

print(f"SUCCESS: Written master model list with {len(seen_global_urls)} unique download links to download.txt and model-list.txt")

