import os
import json
import re

WORKFLOWS_DIR = r"d:\AI GENRATION\LAB\SIMPLEPOD SECRET\MODEL SIZE CALCULATOR\workflows"
DOWNLOAD_TXT = r"d:\AI GENRATION\LAB\SIMPLEPOD SECRET\MODEL SIZE CALCULATOR\download.txt"
MODEL_REPORT_TXT = r"d:\AI GENRATION\LAB\SIMPLEPOD SECRET\MODEL SIZE CALCULATOR\model_report.txt"
MODEL_LIST_TXT = r"d:\AI GENRATION\LAB\SIMPLEPOD SECRET\MODEL SIZE CALCULATOR\model-list.txt"
OUTPUT_JSON = r"d:\AI GENRATION\LAB\SIMPLEPOD SECRET\MODEL SIZE CALCULATOR\src\data\workflowsData.json"

# Known fallback URLs for preprocessor/aux models automatically fetched by nodes
KNOWN_PREPROCESSOR_MAP = {
    "yolox_l.onnx": {
        "url": "https://huggingface.co/yustc/onnxwdet/resolve/main/yolox_l.onnx",
        "folder": "sams",
        "size": "217.40 MB"
    },
    "depth_anything_v2_vitl.pth": {
        "url": "https://huggingface.co/depth-anything/Depth-Anything-V2-Large/resolve/main/depth_anything_v2_vitl.pth",
        "folder": "sams",
        "size": "1.34 GB"
    },
    "sam2_hiera_base_plus.safetensors": {
        "url": "https://huggingface.co/facebook/sam2-hiera-base-plus/resolve/main/sam2_hiera_base_plus.safetensors",
        "folder": "sams",
        "size": "323.00 MB"
    },
    "depth_anything_vitl14.pth": {
        "url": "https://huggingface.co/LiheYoung/depth_anything_vitl14/resolve/main/depth_anything_vitl14.pth",
        "folder": "sams",
        "size": "1.32 GB"
    },
    "dw-ll_ucoco_384_bs5.torchscript.pt": {
        "url": "https://huggingface.co/yustc/onnxwdet/resolve/main/dw-ll_ucoco_384_bs5.torchscript.pt",
        "folder": "sams",
        "size": "140.00 MB"
    }
}

link_database = {}

def process_line(line):
    line = line.strip()
    if not line or line.startswith("#"):
        return
    parts = line.split()
    if len(parts) >= 2:
        url = parts[0]
        folder = parts[1]
        filename = parts[2] if len(parts) > 2 else os.path.basename(url)
        link_database[filename] = {"url": url, "folder": folder, "name": filename}
        link_database[os.path.basename(url)] = {"url": url, "folder": folder, "name": filename}

if os.path.exists(DOWNLOAD_TXT):
    with open(DOWNLOAD_TXT, "r", encoding="utf-8") as f:
        for line in f:
            process_line(line)

if os.path.exists(MODEL_LIST_TXT):
    with open(MODEL_LIST_TXT, "r", encoding="utf-8") as f:
        for line in f:
            process_line(line)

# Add preprocessor map into link database
for fname, info in KNOWN_PREPROCESSOR_MAP.items():
    if fname not in link_database:
        link_database[fname] = {
            "url": info["url"],
            "folder": info["folder"],
            "name": fname,
            "size": info["size"]
        }

if os.path.exists(MODEL_REPORT_TXT):
    with open(MODEL_REPORT_TXT, "r", encoding="utf-8") as f:
        content = f.read()
        entries = content.split("\n\n")
        for entry in entries:
            name, size, saveto, link = None, "Unknown", "Unknown", None
            for line in entry.split("\n"):
                if line.startswith("Name:"):
                    name = line.replace("Name:", "").strip()
                elif line.startswith("Size:"):
                    size = line.replace("Size:", "").strip()
                elif line.startswith("SaveTo:"):
                    saveto = line.replace("SaveTo:", "").strip()
                elif line.startswith("Link:"):
                    link = line.replace("Link:", "").strip()
            if link:
                base_name = os.path.basename(link)
                if base_name in link_database:
                    link_database[base_name]["size"] = size
                elif name and os.path.basename(name) in link_database:
                    link_database[os.path.basename(name)]["size"] = size
                else:
                    link_database[base_name] = {"url": link, "folder": saveto, "name": base_name, "size": size}

workflows = []

for root, dirs, files in os.walk(WORKFLOWS_DIR):
    category = os.path.basename(root)
    if root == WORKFLOWS_DIR:
        category = "GENERAL"
    
    for file in files:
        if file.endswith(".json"):
            filepath = os.path.join(root, file)
            wf_name = os.path.splitext(file)[0]
            try:
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    data = json.load(f)
                
                nodes = data.get("nodes", [])
                models_found = []
                
                for node in nodes:
                    node_type = node.get("type", "")
                    widgets = node.get("widgets_values", [])
                    props = node.get("properties", {})
                    
                    if "models" in props and isinstance(props["models"], list):
                        for m in props["models"]:
                            m_name = m.get("name")
                            m_url = m.get("url")
                            m_dir = m.get("directory", "checkpoints")
                            if m_name:
                                models_found.append({
                                    "filename": m_name,
                                    "nodeType": node_type,
                                    "suggestedFolder": m_dir,
                                    "url": m_url
                                })
                    
                    if isinstance(widgets, list):
                        for w in widgets:
                            if isinstance(w, str) and any(w.endswith(ext) for ext in [".safetensors", ".pth", ".gguf", ".ckpt", ".bin", ".onnx", ".torchscript.pt"]):
                                fname = os.path.basename(w)
                                folder = "checkpoints"
                                if "VAELoader" in node_type or "vae" in fname.lower():
                                    folder = "vae"
                                elif "CLIP" in node_type or "text_encoders" in fname.lower() or "clip" in fname.lower() or "t5" in fname.lower():
                                    folder = "clip"
                                elif "Lora" in node_type or "lora" in fname.lower():
                                    folder = "loras"
                                elif "UNET" in node_type or "Diffusion" in node_type or "diffusion" in fname.lower():
                                    folder = "diffusion_models"
                                elif "ControlNet" in node_type or "controlnet" in fname.lower():
                                    folder = "controlnet"
                                elif "LLM" in node_type or fname.endswith(".gguf"):
                                    folder = "llm_gguf"
                                elif "Depth" in node_type or "SAM" in node_type or "DWPre" in node_type or fname.endswith(".pth") or fname.endswith(".onnx") or fname.endswith(".pt"):
                                    folder = "sams"
                                
                                models_found.append({
                                    "filename": fname,
                                    "nodeType": node_type,
                                    "suggestedFolder": folder
                                })
                            elif isinstance(w, dict) and w.get("lora"):
                                fname = os.path.basename(w.get("lora"))
                                models_found.append({
                                    "filename": fname,
                                    "nodeType": node_type,
                                    "suggestedFolder": "loras"
                                })

                unique_models = {}
                for m in models_found:
                    fname = m["filename"]
                    if fname not in unique_models:
                        matched = link_database.get(fname, link_database.get(os.path.basename(fname), {}))
                        unique_models[fname] = {
                            "name": fname,
                            "folder": m.get("suggestedFolder") or matched.get("folder", "checkpoints"),
                            "url": m.get("url") or matched.get("url", ""),
                            "size": matched.get("size", "Unknown"),
                            "nodeType": m.get("nodeType", "")
                        }
                
                workflows.append({
                    "id": wf_name.replace(" ", "_").lower(),
                    "name": wf_name,
                    "category": category,
                    "file": file,
                    "models": list(unique_models.values())
                })
            except Exception as e:
                print(f"Error reading {file}: {e}")

output_data = {
    "catalog": list(link_database.values()),
    "workflows": workflows
}

with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(output_data, f, indent=2)

print(f"Successfully re-indexed {len(workflows)} workflows with preprocessor model maps!")
