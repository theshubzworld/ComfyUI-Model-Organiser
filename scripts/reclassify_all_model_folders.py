"""
Reclassify and auto-correct all model folders in master-model-list.txt & Supabase DB
"""
import os
import re
import psycopg2

def guess_folder(filename, current_folder="checkpoints"):
    f = str(filename).lower().strip()
    
    # 1. VAE
    if 'vae' in f or f.endswith('_ae.safetensors') or f.endswith('_ae.pt'):
        return 'vae'
        
    # 2. LoRA
    if 'lora' in f or 'locon' in f or 'dora' in f or 'slider' in f:
        return 'loras'
        
    # 3. Text Encoders / CLIP / Qwen / T5
    if any(k in f for k in ['qwen', 't5', 't5xxl', 'clip', 'text_encoder', 'text_encoders', 'umt5', 'openclip']):
        return 'clip'
        
    # 4. ControlNet
    if any(k in f for k in ['controlnet', 'control', 'depthanything']):
        return 'controlnet'
        
    # 5. Upscale
    if any(k in f for k in ['upscale', 'esrgan', 'spandrel', 'realesrgan']):
        return 'upscale_models'
        
    # 6. GGUF Models
    if f.endswith('.gguf') or 'gguf' in f:
        if any(k in f for k in ['flux', 'wan', 'ltx', 'hunyuan', 'cogvideo', 'unet', 'diffusion', 'transformer', 'sdxl', 'sd3']):
            return 'unet'
        if any(k in f for k in ['llama', 'mistral', 'gemma', 'llm', 'qwen']):
            return 'LLM'
        return 'unet'
        
    # 7. Split Transformer / Diffusion Models
    if any(k in f for k in ['klein', 'flux', 'ltx', 'wan2', 'wan_2', 'wan', 'hunyuan', 'cogvideo', 'mochi', 'lumina', 'pixart', 'auraflow', 'transformer', 'diffusion', 'unet']):
        return 'diffusion_models'
        
    # 8. Checkpoints
    if any(k in f for k in ['checkpoint', 'sdxl', 'sd_1', 'sd1.5', 'sd15', 'pony', 'illustrious', 'noobai', 'realism']):
        return 'checkpoints'
        
    return current_folder or 'checkpoints'

# 1. Update data/master-model-list.txt
TXT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "master-model-list.txt")

if os.path.exists(TXT_PATH):
    with open(TXT_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    updated_lines = []
    changes = 0
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
            new_folder = guess_folder(filename, cur_folder)
            
            if new_folder != cur_folder:
                changes += 1
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
    print(f"Updated master-model-list.txt with {changes} folder corrections.")

# 2. Update Supabase Database rows
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
    
    # Fix user_model_overrides
    cur.execute("SELECT user_id, model_id, name, folder FROM public.user_model_overrides;")
    rows = cur.fetchall()
    override_fixes = 0
    for uid, mid, name, folder in rows:
        correct = guess_folder(name or mid, folder)
        if correct != folder:
            cur.execute(
                "UPDATE public.user_model_overrides SET folder = %s WHERE user_id = %s AND model_id = %s;",
                (correct, uid, mid)
            )
            override_fixes += 1
            
    # Fix user_custom_models
    cur.execute("SELECT id, name, folder FROM public.user_custom_models;")
    c_rows = cur.fetchall()
    custom_fixes = 0
    for cid, name, folder in c_rows:
        correct = guess_folder(name or cid, folder)
        if correct != folder:
            cur.execute(
                "UPDATE public.user_custom_models SET folder = %s WHERE id = %s;",
                (correct, cid)
            )
            custom_fixes += 1
            
    conn.commit()
    print(f"Database updated: {override_fixes} user_model_overrides fixed, {custom_fixes} user_custom_models fixed.")
    cur.close()
    conn.close()
except Exception as e:
    print("Database update error:", type(e).__name__, str(e))
