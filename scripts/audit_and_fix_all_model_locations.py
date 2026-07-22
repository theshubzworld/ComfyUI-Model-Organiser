"""
Comprehensive Audit & Correction Script for Model Names & Folder Locations
"""
import os
import re
import json
import psycopg2

def canonical_folder(filename, current_folder="checkpoints"):
    f = str(filename).lower().strip()
    cur = str(current_folder).lower().replace("models/", "").strip()
    
    # 1. VAE Models -> models/vae
    if 'vae' in f or f.endswith('_ae.safetensors') or f.endswith('_ae.pt') or f == 'ae.safetensors':
        return 'vae'
        
    # 2. LoRA / LoCon / DoRA / Lightning -> models/loras
    if any(k in f for k in ['lora', 'locon', 'dora', 'slider', 'lightning']):
        return 'loras'
        
    # 3. ControlNet / Depth / Pose -> models/controlnet
    if any(k in f for k in ['controlnet', 'control', 'depthanything', 'openpose']):
        return 'controlnet'
        
    # 4. ONNX / Object Detection / Face Parsing / SAM -> models/sams or models/detection
    if f.endswith('.onnx') or any(k in f for k in ['yolo', 'vitpose', 'torchscript', 'insightface']):
        return 'insightface' if 'insightface' in f else 'sams'
        
    # 5. Upscale Models -> models/upscale_models
    if any(k in f for k in ['upscale', 'esrgan', 'spandrel', 'realesrgan']):
        return 'upscale_models'
        
    # 6. GGUF Models -> models/unet or models/LLM
    if f.endswith('.gguf') or 'gguf' in f:
        if any(k in f for k in ['flux', 'wan', 'ltx', 'hunyuan', 'cogvideo', 'unet', 'diffusion', 'transformer', 'sdxl', 'sd3', 'qwen-image', 'qwen_image']):
            return 'unet'
        if any(k in f for k in ['llama', 'mistral', 'gemma', 'llm', 'qwen']):
            return 'LLM'
        return 'unet'
        
    # 7. Split Transformer / Diffusion Models / UNet -> models/diffusion_models
    if any(k in f for k in ['klein', 'flux', 'ltx', 'wan2', 'wan_2', 'wan', 'hunyuan', 'cogvideo', 'mochi', 'lumina', 'pixart', 'auraflow', 'transformer', 'diffusion', 'unet', 'qwen_image_', 'qwen-image-', 'edit_']):
        return 'diffusion_models'

    # 8. Text Encoders / CLIP / T5 / Gemma / Qwen VL Text Encoders -> models/clip
    if any(k in f for k in ['clip', 't5', 't5xxl', 'text_encoder', 'text_encoders', 'umt5', 'openclip', 'sigclip', 'siglip', 'gemma', 'qwen_2.5_vl', 'qwen_3_8b', 'qwen_3_4b', 'qwen_0.6b', 'qwen_1.7b', 'qwen3vl', 'qwenvision']):
        return 'clip'
        
    # 9. Checkpoints
    if any(k in f for k in ['checkpoint', 'sdxl', 'sd_1', 'sd1.5', 'sd15', 'pony', 'illustrious', 'noobai', 'realism']):
        return 'checkpoints'
        
    return cur if cur != 'checkpoints' else 'checkpoints'

# --- 1. Audit workflowsData.json ---
JSON_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "src", "data", "workflowsData.json")

if os.path.exists(JSON_PATH):
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        wf_data = json.load(f)
        
    json_changes = 0
    
    # Audit catalog
    for item in wf_data.get("catalog", []):
        name = item.get("name") or item.get("filename") or os.path.basename(item.get("url", "").split("?")[0])
        old_folder = item.get("folder", "checkpoints")
        new_folder = canonical_folder(name, old_folder)
        if new_folder != old_folder:
            item["folder"] = new_folder
            json_changes += 1
            
    # Audit workflows models
    for wf in wf_data.get("workflows", []):
        for item in wf.get("models", []):
            name = item.get("name") or item.get("filename") or os.path.basename(item.get("url", "").split("?")[0])
            old_folder = item.get("folder", "checkpoints")
            new_folder = canonical_folder(name, old_folder)
            if new_folder != old_folder:
                item["folder"] = new_folder
                json_changes += 1
                
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(wf_data, f, indent=2)
    print(f"Updated workflowsData.json: fixed {json_changes} model folder locations.")

# --- 2. Audit master-model-list.txt ---
TXT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "master-model-list.txt")

if os.path.exists(TXT_PATH):
    with open(TXT_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    updated_lines = []
    txt_changes = 0
    for line in lines:
        raw = line.strip()
        if not raw or raw.startswith("#"):
            updated_lines.append(line)
            continue
            
        parts = raw.split(None, 2)
        if len(parts) >= 2 and parts[0].startswith("http"):
            url = parts[0]
            folder_path = parts[1]
            custom_name = parts[2] if len(parts) > 2 else ""
            
            filename = custom_name
            if not filename and ('/' in folder_path or '\\' in folder_path):
                filename = folder_path.replace('\\', '/').split('/')[-1]
            if not filename:
                filename = os.path.basename(url.split('?')[0])
                
            cur_folder = folder_path.replace('\\', '/').split('/')[0]
            new_folder = canonical_folder(filename, cur_folder)
            
            if new_folder != cur_folder:
                txt_changes += 1
                new_folder_path = f"models/{new_folder}" if folder_path.startswith("models/") else new_folder
                if custom_name:
                    new_line = f"{url} {new_folder_path} {custom_name}\n"
                else:
                    new_line = f"{url} {new_folder_path}\n"
                updated_lines.append(new_line)
            else:
                updated_lines.append(line)
        else:
            updated_lines.append(line)
            
    with open(TXT_PATH, "w", encoding="utf-8") as f:
        f.writelines(updated_lines)
    print(f"Updated master-model-list.txt: fixed {txt_changes} model folder locations.")

# --- 3. Audit Supabase Database ---
password = os.getenv('SUPABASE_DB_PASSWORD', 'Mycomfyui!!@@751')

try:
    conn = psycopg2.connect(
        host=os.getenv('SUPABASE_DB_HOST', 'db.fgrmbmltnqinmtgzrbpi.supabase.co'),
        port=int(os.getenv('SUPABASE_DB_PORT', 5432)),
        dbname=os.getenv('SUPABASE_DB_NAME', 'postgres'),
        user=os.getenv('SUPABASE_DB_USER', 'postgres'),
        password=password,
        sslmode='require',
        connect_timeout=15
    )
    cur = conn.cursor()
    
    # Audit user_model_overrides
    cur.execute("SELECT user_id, model_id, name, folder FROM public.user_model_overrides;")
    rows = cur.fetchall()
    override_fixes = 0
    for uid, mid, name, folder in rows:
        correct = canonical_folder(name or mid, folder)
        if correct != folder:
            cur.execute(
                "UPDATE public.user_model_overrides SET folder = %s WHERE user_id = %s AND model_id = %s;",
                (correct, uid, mid)
            )
            override_fixes += 1
            
    # Audit user_custom_models
    cur.execute("SELECT id, name, folder FROM public.user_custom_models;")
    c_rows = cur.fetchall()
    custom_fixes = 0
    for cid, name, folder in c_rows:
        correct = canonical_folder(name or cid, folder)
        if correct != folder:
            cur.execute(
                "UPDATE public.user_custom_models SET folder = %s WHERE id = %s;",
                (correct, cid)
            )
            custom_fixes += 1
            
    conn.commit()
    print(f"Database audit: {override_fixes} user_model_overrides fixed, {custom_fixes} user_custom_models fixed.")
    cur.close()
    conn.close()
except Exception as e:
    print("Database audit error:", type(e).__name__, str(e))
