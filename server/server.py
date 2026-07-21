import os
import re
import sys
import json
import requests
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 3001
# server.py lives in server/ — root is one level up
SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR   = os.path.dirname(SERVER_DIR)
DATA_DIR        = os.path.join(ROOT_DIR, "data")
DOWNLOAD_TXT    = os.path.join(DATA_DIR, "master-model-list.txt")
MODEL_LIST_TXT  = os.path.join(DATA_DIR, "master-model-list.txt")
CIVITAI_TXT     = os.path.join(DATA_DIR, "civitai_download.txt")
MODEL_CACHE_FILE = os.path.join(DATA_DIR, "model_cache.json")
ENV_FILE        = os.path.join(ROOT_DIR, ".env")

# ─── Permanent Model Cache System (Persists fetched sizes & resolved names) ──
def load_model_cache():
    if os.path.exists(MODEL_CACHE_FILE):
        try:
            with open(MODEL_CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_model_cache(cache):
    try:
        with open(MODEL_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2)
    except Exception as e:
        print(f"[cache] Failed to save model_cache.json: {e}")

def update_cache_entry(url, size=None, name=None, folder=None):
    if not url:
        return
    clean_url, _ = extract_token_from_url(url.replace("civitai.red", "civitai.com"))
    cache = load_model_cache()
    entry = cache.get(clean_url, {})
    changed = False
    if size and size != "Unknown":
        entry["size"] = size
        changed = True
    if name and not re.match(r'^\d+$', str(name)) and not str(name).startswith('civitai_'):
        entry["name"] = name
        changed = True
    if folder:
        entry["folder"] = folder
        changed = True
    if changed:
        cache[clean_url] = entry
        save_model_cache(cache)



# ─── CivitAI URL utilities ────────────────────────────────────────────────────
def extract_token_from_url(url):
    """Extract &token=xxx or ?token=xxx from a CivitAI URL, return (clean_url, token)."""
    match = re.search(r'[?&]token=([a-f0-9]+)', url)
    if match:
        token = match.group(1)
        clean = re.sub(r'[?&]token=[a-f0-9]+', '', url)
        # Fix dangling ? or & after removal
        clean = re.sub(r'\?&', '?', clean).rstrip('?&')
        return clean, token
    return url, ''

def get_civitai_model_name(version_id, token='', session=None):
    """
    Fetch the primary file name for a CivitAI model version from the API.
    Returns filename string or empty string on failure.
    Uses token from param or reads from .env / _state.
    """
    if not token:
        try:
            env = load_env_file()
            token = env.get("VITE_CIVITAI_TOKEN", "") or _state.get("civitai_token", "")
        except Exception:
            pass

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        api_url = f'https://civitai.com/api/v1/model-versions/{version_id}'
        if token:
            api_url += f'?token={token}'

        s = session or requests
        r = s.get(api_url, headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            files = data.get('files', [])
            # Prefer the primary file
            primary = next((f for f in files if f.get('primary')), files[0] if files else None)
            if primary:
                return primary.get('name', '')
    except Exception as e:
        print(f'[civitai] API error for version {version_id}: {e}')
    return ''

def parse_civitai_txt(filepath, fallback_token=''):
    """
    Parse civitai_download.txt into a list of model dicts.
    Handles three line formats:
      URL folder                          → fetch name from CivitAI API
      URL folder/filename.ext             → extract folder + filename from path
      URL folder/sub/filename.ext         → same, keep subfolder in name
    Also handles civitai.red mirror domain.
    Tokens embedded in URLs are extracted and stripped.
    Returns (models_list, discovered_token).
    """
    if not os.path.exists(filepath):
        return [], ''

    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    seen_version_ids = set()
    models = []
    discovered_token = fallback_token

    with requests.Session() as session:
        for raw_line in lines:
            line = raw_line.strip()
            if not line or line.startswith('#'):
                continue

            parts = line.split(None, 1)  # split on first whitespace only
            if len(parts) < 1 or not parts[0].startswith('http'):
                continue

            raw_url = parts[0]
            path_part = parts[1].strip() if len(parts) > 1 else ''

            # Normalize civitai.red -> civitai.com
            clean_url = raw_url.replace('civitai.red', 'civitai.com')

            # Extract embedded token
            clean_url, embedded_token = extract_token_from_url(clean_url)
            if embedded_token and not discovered_token:
                discovered_token = embedded_token

            # Use discovered token for API calls
            api_token = embedded_token or discovered_token

            # Extract model version ID from URL
            # e.g. /api/download/models/2509620?...
            vid_match = re.search(r'/models/(\d+)', clean_url)
            version_id = vid_match.group(1) if vid_match else ''

            # Skip duplicates by version_id
            if version_id and version_id in seen_version_ids:
                continue
            if version_id:
                seen_version_ids.add(version_id)

            # Determine folder and filename from path_part
            if path_part and ('/' in path_part or '\\' in path_part):
                # Has a full sub-path like loras/boob_slider.safetensors
                # Separate top-level folder from the rest
                path_parts = path_part.replace('\\', '/').split('/')
                folder = path_parts[0]  # top folder = loras / checkpoints etc.
                name = path_parts[-1]   # last segment = filename
            elif path_part and '.' in path_part.split('/')[-1]:
                # Single token that looks like a filename
                folder = 'loras'
                name = path_part
            elif path_part:
                # Just a folder name — need to fetch from API
                folder = path_part
                name = ''
                if version_id:
                    print(f'[civitai] Fetching name for version {version_id}...')
                    name = get_civitai_model_name(version_id, api_token, session)
                    if not name:
                        name = f'civitai_{version_id}.safetensors'
            else:
                folder = 'loras'
                name = ''
                if version_id:
                    name = get_civitai_model_name(version_id, api_token, session)
                    if not name:
                        name = f'civitai_{version_id}.safetensors'

            cache = load_model_cache()
            cached_entry = cache.get(clean_url, {})
            model_size = cached_entry.get("size", "Unknown")
            if cached_entry.get("name"):
                name = cached_entry["name"]

            # Save to cache if name resolved
            if name and not re.match(r'^\d+$', str(name)) and not str(name).startswith('civitai_'):
                update_cache_entry(clean_url, name=name, folder=folder)

            models.append({
                'id': f'civitai_{version_id or len(models)}',
                'name': name,
                'folder': folder,
                'url': clean_url,   # token stripped from URL
                'size': model_size,
                'source': 'civitai_download.txt',
                'nodeType': 'CivitAI'
            })

    return models, discovered_token

def parse_model_list_txt(filepath=MODEL_LIST_TXT):
    """
    Parse model-list.txt into a list of model dicts.
    Handles lines formatted as:
      URL folder [custom_filename]
      URL folder/subfolder/filename.ext
    Automatically fetches real filenames for CivitAI links when missing or numeric ID.
    Merges permanent cached sizes and resolved names from model_cache.json.
    """
    if not os.path.exists(filepath):
        return []
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()

    models = []
    seen_urls = set()
    env = load_env_file()
    civitai_token = env.get("VITE_CIVITAI_TOKEN", "") or _state.get("civitai_token", "")
    cache = load_model_cache()

    with requests.Session() as session:
        for idx, raw_line in enumerate(lines):
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split(None, 2)
            if len(parts) < 1 or not parts[0].startswith("http"):
                continue

            raw_url = parts[0]
            clean_url = raw_url.replace("civitai.red", "civitai.com")
            clean_url, embedded_token = extract_token_from_url(clean_url)
            api_token = embedded_token or civitai_token

            if clean_url in seen_urls:
                continue
            seen_urls.add(clean_url)

            folder_part = parts[1].strip() if len(parts) > 1 else "checkpoints"
            custom_name = parts[2].strip() if len(parts) > 2 else ""

            folder = folder_part
            filename = custom_name

            if "/" in folder_part or "\\" in folder_part:
                p_parts = folder_part.replace("\\", "/").split("/")
                folder = p_parts[0]
                if not filename and p_parts[-1].endswith((".safetensors", ".pth", ".pt", ".bin", ".gguf", ".onnx", ".ckpt", ".zip")):
                    filename = p_parts[-1]

            if not filename:
                filename = os.path.basename(clean_url.split("?")[0])

            # Resolve real filename from CivitAI API if filename is pure numeric ID or starts with civitai_
            if ("civitai.com" in clean_url or "civitai.red" in clean_url) and (not filename or re.match(r'^\d+$', filename) or filename.startswith('civitai_')):
                vid_match = re.search(r'/models/(\d+)', clean_url)
                if vid_match:
                    version_id = vid_match.group(1)
                    real_name = get_civitai_model_name(version_id, api_token, session)
                    if real_name:
                        filename = real_name

            # Merge cached size & name from model_cache.json
            cached_entry = cache.get(clean_url, {})
            model_size = cached_entry.get("size", "Unknown")
            if cached_entry.get("name"):
                filename = cached_entry["name"]

            # Save to cache if name or size is present
            update_cache_entry(clean_url, size=model_size, name=filename, folder=folder)

            source = "HuggingFace" if "huggingface.co" in clean_url else ("CivitAI" if "civitai" in clean_url else "Custom")

            models.append({
                "id": f"ml_{idx}_{len(models)}",
                "name": filename,
                "folder": folder,
                "url": clean_url,
                "size": model_size,
                "source": source,
                "nodeType": source
            })

    return models


# ─── .env loader (no external deps required) ────────────────────────────────
def load_env_file(path=ENV_FILE):
    """Parse KEY=VALUE lines from .env, ignoring comments and blanks."""
    env = {}
    if not os.path.exists(path):
        return env
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, _, value = line.partition("=")
                env[key.strip()] = value.strip().strip('"').strip("'")
    return env

def save_env_file(updates: dict, path=ENV_FILE):
    """
    Write updated token values back to .env, preserving all comments,
    blank lines, and unrelated variables.
    """
    # Read existing lines
    lines = []
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()

    updated_keys = set()

    # Update existing key lines in-place
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("#") or not stripped or "=" not in stripped:
            new_lines.append(line)
            continue
        key = stripped.split("=", 1)[0].strip()
        if key in updates:
            new_lines.append(f"{key}={updates[key]}\n")
            updated_keys.add(key)
        else:
            new_lines.append(line)

    # Append any keys that were not already in the file
    for key, value in updates.items():
        if key not in updated_keys:
            new_lines.append(f"{key}={value}\n")

    with open(path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

# ─── Load tokens from .env on startup ────────────────────────────────────────
_env = load_env_file()
# Use a mutable dict so class methods can update tokens without global declarations
_state = {
    "hf_token": _env.get("VITE_HF_TOKEN", ""),
    "civitai_token": _env.get("VITE_CIVITAI_TOKEN", ""),
}

if _state["hf_token"]:
    print(f"[tokens] HuggingFace token loaded from .env ({_state['hf_token'][:8]}...)")
if _state["civitai_token"]:
    print(f"[tokens] CivitAI token loaded from .env ({_state['civitai_token'][:8]}...)")

# ─── HTTP Handler ─────────────────────────────────────────────────────────────
class SizeCheckerHandler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Suppress default request logs to keep terminal clean
        pass

    def send_json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path in ("/api/get-tokens", "/api/tokens"):
            # Return tokens from .env (re-read fresh in case they changed)
            env = load_env_file()
            hf = env.get("VITE_HF_TOKEN", "")
            civitai = env.get("VITE_CIVITAI_TOKEN", "")
            self.send_json(200, {
                "hfToken": hf,
                "civitaiToken": civitai,
                "hfConfigured": bool(hf),
                "civitaiConfigured": bool(civitai),
            })

        elif self.path == "/api/import-civitai-file":
            # Parse civitai_download.txt, resolve names, strip tokens, return JSON
            env = load_env_file()
            stored_token = env.get("VITE_CIVITAI_TOKEN", "") or _state["civitai_token"]


            if not os.path.exists(CIVITAI_TXT):
                self.send_json(404, {"error": f"civitai_download.txt not found at {CIVITAI_TXT}"})
                return

            print(f"[civitai] Parsing {CIVITAI_TXT} ...")
            models, discovered_token = parse_civitai_txt(CIVITAI_TXT, stored_token)

            # Auto-save discovered token to .env if it's new
            if discovered_token and discovered_token != stored_token:
                save_env_file({"VITE_CIVITAI_TOKEN": discovered_token})
                _state["civitai_token"] = discovered_token
                print(f"[civitai] Saved discovered token to .env: {discovered_token[:8]}...")


            print(f"[civitai] Parsed {len(models)} unique models")
            self.send_json(200, {
                "models": models,
                "count": len(models),
                "discoveredToken": discovered_token,
                "tokenSaved": bool(discovered_token and discovered_token != stored_token),
            })

        elif self.path == "/api/load-model-list":
            # Read and parse model-list.txt (containing models.txt + workflow models + civitai models)
            models = parse_model_list_txt(MODEL_LIST_TXT)
            self.send_json(200, {
                "models": models,
                "count": len(models),
            })


        elif self.path.startswith("/api/search-models"):
            from urllib.parse import urlparse, parse_qs, quote
            qs = parse_qs(urlparse(self.path).query)
            raw_query = qs.get("q", [""])[0].strip()
            requested_platform = qs.get("platform", ["both"])[0]  # 'hf' | 'civitai' | 'both'

            if not raw_query:
                self.send_json(400, {"error": "Missing query parameter ?q="})
                return

            env = load_env_file()
            hf_token = env.get("VITE_HF_TOKEN", "") or _state["hf_token"]
            civitai_token = env.get("VITE_CIVITAI_TOKEN", "") or _state["civitai_token"]

            # Generate candidate search terms (strict -> relaxed -> key tokens)
            tags = {"t2v", "i2v", "low", "high", "safetensors", "ckpt", "v1", "v2", "lora", "xl", "sdxl", "fp16", "fp8"}
            words = [w for w in re.split(r'[-_\s\.]+', raw_query) if w]
            significant = [w for w in words if len(w) > 2 and w.lower() not in tags]

            terms = [raw_query]
            if " ".join(words) != raw_query:
                terms.append(" ".join(words))
            if significant:
                terms.append(" ".join(significant))
                for w in significant:
                    if len(w) > 3 and w not in terms:
                        terms.append(w)

            results = []
            seen_urls = set()

            # Helper to search HuggingFace
            def fetch_hf(q):
                try:
                    hf_headers = {"User-Agent": "SimplePod-ModelCalculator/1.0"}
                    if hf_token:
                        hf_headers["Authorization"] = f"Bearer {hf_token}"
                    search_url = f"https://huggingface.co/api/models?search={quote(q)}&limit=6&sort=downloads&direction=-1"
                    r = requests.get(search_url, headers=hf_headers, timeout=8)
                    if r.status_code != 200:
                        return []
                    hf_models = r.json()
                    res = []
                    for hm in hf_models[:6]:
                        model_id = hm.get("modelId") or hm.get("id", "")
                        mtype = "unknown"
                        for t in hm.get("tags", []):
                            if t in ("lora", "LoRA"): mtype = "loras"; break
                            if t in ("text-to-image", "diffusers", "stable-diffusion"): mtype = "checkpoints"; break
                            if t in ("text-generation", "gguf"): mtype = "unet"; break

                        files_url = f"https://huggingface.co/api/models/{model_id}"
                        fr = requests.get(files_url, headers=hf_headers, timeout=6)
                        model_files = []
                        if fr.status_code == 200:
                            fdata = fr.json()
                            model_files = [
                                s for s in fdata.get("siblings", [])
                                if any(s.get("rfilename", "").endswith(ext)
                                       for ext in (".safetensors", ".ckpt", ".pt", ".bin", ".gguf", ".onnx", ".pth"))
                            ]
                        if model_files:
                            for mf in model_files[:2]:
                                fname = mf.get("rfilename", "")
                                fsize = mf.get("size", 0)
                                mb = fsize / (1024 * 1024) if fsize else 0
                                size_str = f"{mb/1024:.2f} GB" if mb >= 1024 else (f"{mb:.2f} MB" if mb > 0 else "Unknown")
                                dl_url = f"https://huggingface.co/{model_id}/resolve/main/{fname}"
                                res.append({
                                    "platform": "huggingface",
                                    "name": fname,
                                    "modelName": model_id.split("/")[-1],
                                    "author": model_id.split("/")[0] if "/" in model_id else "",
                                    "repoId": model_id,
                                    "url": dl_url,
                                    "size": size_str,
                                    "type": mtype,
                                    "downloads": hm.get("downloads", 0),
                                })
                        else:
                            res.append({
                                "platform": "huggingface",
                                "name": model_id.split("/")[-1],
                                "modelName": model_id.split("/")[-1],
                                "author": model_id.split("/")[0] if "/" in model_id else "",
                                "repoId": model_id,
                                "url": f"https://huggingface.co/{model_id}",
                                "size": "Unknown",
                                "type": mtype,
                                "downloads": hm.get("downloads", 0),
                            })
                    return res
                except Exception as e:
                    print(f"[search] HF error for '{q}': {e}")
                    return []

            # Helper to search CivitAI
            def fetch_civitai(q):
                try:
                    civ_headers = {"User-Agent": "SimplePod-ModelCalculator/1.0"}
                    if civitai_token:
                        civ_headers["Authorization"] = f"Bearer {civitai_token}"
                    civ_url = f"https://civitai.com/api/v1/models?query={quote(q)}&limit=6&sort=Highest%20Rated"
                    r = requests.get(civ_url, headers=civ_headers, timeout=8)
                    if r.status_code != 200:
                        return []
                    civ_data = r.json()
                    res = []
                    for cm in civ_data.get("items", [])[:6]:
                        model_type = cm.get("type", "").lower()
                        folder_map = {
                            "lora": "loras", "locon": "loras",
                            "checkpoint": "checkpoints",
                            "textualinversion": "embeddings",
                            "vae": "vae", "controlnet": "controlnet",
                            "upscaler": "upscale_models",
                        }
                        folder = folder_map.get(model_type, "loras")
                        versions = cm.get("modelVersions", [])
                        if not versions: continue
                        latest = versions[0]
                        version_id = latest.get("id")
                        files = latest.get("files", [])
                        primary = next((f for f in files if f.get("primary")), files[0] if files else None)
                        if primary:
                            size_kb = primary.get("sizeKB", 0)
                            mb = size_kb / 1024 if size_kb else 0
                            size_str = f"{mb/1024:.2f} GB" if mb >= 1024 else (f"{mb:.2f} MB" if mb > 0 else "Unknown")
                            dl_url = f"https://civitai.com/api/download/models/{version_id}?type=Model&format=SafeTensor"
                            res.append({
                                "platform": "civitai",
                                "name": primary.get("name", f"civitai_{version_id}.safetensors"),
                                "modelName": cm.get("name", ""),
                                "author": cm.get("creator", {}).get("username", ""),
                                "versionId": version_id,
                                "versionName": latest.get("name", ""),
                                "url": dl_url,
                                "size": size_str,
                                "type": folder,
                                "downloads": cm.get("stats", {}).get("downloadCount", 0),
                                "rating": cm.get("stats", {}).get("rating", 0),
                            })
                    return res
                except Exception as e:
                    print(f"[search] CivitAI error for '{q}': {e}")
                    return []

            # 1. Primary search over candidate terms
            platforms_to_search = ["hf", "civitai"] if requested_platform == "both" else [requested_platform]

            for term in terms:
                if len(results) >= 6:
                    break
                if "hf" in platforms_to_search:
                    hf_items = fetch_hf(term)
                    print(f"[search-debug] term='{term}' -> hf_items={len(hf_items)}")
                    for item in hf_items:
                        if item["url"] not in seen_urls:
                            seen_urls.add(item["url"])
                            results.append(item)
                if "civitai" in platforms_to_search:
                    civ_items = fetch_civitai(term)
                    print(f"[search-debug] term='{term}' -> civ_items={len(civ_items)}")
                    for item in civ_items:
                        if item["url"] not in seen_urls:
                            seen_urls.add(item["url"])
                            results.append(item)


            # 2. Fallback search if requested platform yielded 0 results
            fallback_platform = None
            if not results and requested_platform != "both":
                other = "civitai" if requested_platform == "hf" else "hf"
                for term in terms:
                    if len(results) >= 6: break
                    items = fetch_civitai(term) if other == "civitai" else fetch_hf(term)
                    for item in items:
                        if item["url"] not in seen_urls:
                            seen_urls.add(item["url"])
                            results.append(item)
                if results:
                    fallback_platform = other

            print(f"[search] '{raw_query}' (req={requested_platform}) -> {len(results)} results (fallback={fallback_platform})")
            self.send_json(200, {
                "query": raw_query,
                "requestedPlatform": requested_platform,
                "fallbackPlatform": fallback_platform,
                "results": results,
                "count": len(results)
            })

        # ── /api/civitai-enums ────────────────────────────────────────────────
        elif self.path == "/api/civitai-enums":
            try:
                headers = {"User-Agent": "Mozilla/5.0"}
                r = requests.get("https://civitai.com/api/v1/enums", headers=headers, timeout=8)
                if r.status_code == 200:
                    self.send_json(200, r.json())
                else:
                    self.send_json(r.status_code, {"error": "Failed to fetch CivitAI enums"})
            except Exception as e:
                self.send_json(500, {"error": str(e)})

        # ── /api/civitai-explorer ─────────────────────────────────────────────
        elif self.path.startswith("/api/civitai-explorer"):

            from urllib.parse import urlparse, parse_qs, quote
            qs = parse_qs(urlparse(self.path).query)
            query = qs.get("query", [""])[0].strip() or qs.get("q", [""])[0].strip()
            model_type = qs.get("types", [""])[0].strip()
            base_model = qs.get("baseModels", [""])[0].strip()
            checkpoint_type = qs.get("checkpointType", [""])[0].strip()
            tag = qs.get("tag", [""])[0].strip()
            username = qs.get("username", [""])[0].strip()
            nsfw = qs.get("nsfw", [""])[0].strip()
            sort = qs.get("sort", ["Most Downloaded"])[0].strip()
            period = qs.get("period", ["AllTime"])[0].strip()
            page = int(qs.get("page", ["1"])[0])
            limit = min(50, max(1, int(qs.get("limit", ["20"])[0])))

            env = load_env_file()
            civitai_token = env.get("VITE_CIVITAI_TOKEN", "") or _state["civitai_token"]

            params = [
                f"limit={limit}",
                f"page={page}",
                f"sort={quote(sort)}",
                f"period={quote(period)}",
            ]
            if query:
                params.append(f"query={quote(query)}")
            if model_type and model_type != "All":
                params.append(f"types={quote(model_type)}")
            if base_model and base_model != "All":
                params.append(f"baseModels={quote(base_model)}")
            if checkpoint_type and checkpoint_type != "All":
                params.append(f"checkpointType={quote(checkpoint_type)}")
            if tag and tag != "All":
                params.append(f"tag={quote(tag)}")
            if username:
                params.append(f"username={quote(username)}")
            if nsfw and nsfw != "All":
                if nsfw in ("None", "SFW", "false"):
                    params.append("nsfw=false")
                else:
                    params.append("nsfw=true")

            if civitai_token:
                params.append(f"token={civitai_token}")

            civitai_url = f"https://civitai.com/api/v1/models?{'&'.join(params)}"


            try:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                }
                if civitai_token:
                    headers["Authorization"] = f"Bearer {civitai_token}"

                r = requests.get(civitai_url, headers=headers, timeout=12)
                if r.status_code != 200:
                    self.send_json(r.status_code, {"error": f"CivitAI API returned HTTP {r.status_code}"})
                    return

                raw_data = r.json()
                items = []
                for item in raw_data.get("items", []):
                    m_id = item.get("id")
                    m_name = item.get("name", "")
                    m_type = item.get("type", "Other")
                    m_nsfw = item.get("nsfw", False)
                    m_stats = item.get("stats", {})
                    m_creator = item.get("creator", {})
                    m_tags = item.get("tags", [])

                    versions = []
                    for ver in item.get("modelVersions", []):
                        v_id = ver.get("id")
                        v_name = ver.get("name", "")
                        v_base = ver.get("baseModel", "")
                        v_dl = f"https://civitai.com/api/download/models/{v_id}?type=Model&format=SafeTensor"

                        v_files = []
                        for f in ver.get("files", []):
                            f_kb = f.get("sizeKB", 0)
                            f_mb = f_kb / 1024 if f_kb else 0
                            f_size = f"{f_mb/1024:.2f} GB" if f_mb >= 1024 else (f"{f_mb:.2f} MB" if f_mb > 0 else "Unknown")
                            v_files.append({
                                "id": f.get("id"),
                                "name": f.get("name", f"civitai_{v_id}.safetensors"),
                                "size": f_size,
                                "sizeKB": f_kb,
                                "primary": f.get("primary", False),
                                "downloadUrl": v_dl,
                            })

                        v_images = []
                        for img in ver.get("images", [])[:4]:
                            orig_url = img.get("url", "")
                            # Format optimized width=450 preview thumbnail URL
                            thumb_url = orig_url.replace("/original=true/", "/width=450/").replace("/width=1024/", "/width=450/")
                            v_images.append({
                                "url": thumb_url or orig_url,
                                "nsfw": img.get("nsfwLevel", "None"),
                            })


                        versions.append({
                            "id": v_id,
                            "name": v_name,
                            "baseModel": v_base,
                            "downloadUrl": v_dl,
                            "files": v_files,
                            "images": v_images,
                        })

                    items.append({
                        "id": m_id,
                        "name": m_name,
                        "type": m_type,
                        "nsfw": m_nsfw,
                        "tags": m_tags[:5],
                        "creator": {
                            "username": m_creator.get("username", "Anonymous"),
                            "image": m_creator.get("image", ""),
                        },
                        "stats": {
                            "downloadCount": m_stats.get("downloadCount", 0),
                            "thumbsUpCount": m_stats.get("thumbsUpCount", 0),
                            "rating": m_stats.get("rating", 0),
                            "ratingCount": m_stats.get("ratingCount", 0),
                        },
                        "modelVersions": versions,
                    })

                meta = raw_data.get("metadata", {})
                self.send_json(200, {
                    "items": items,
                    "count": len(items),
                    "page": page,
                    "pageSize": limit,
                    "totalPages": meta.get("totalPages", 1),
                    "totalItems": meta.get("totalItems", len(items)),
                })
            except Exception as e:
                print(f"[civitai-explorer] Error: {e}")
                self.send_json(500, {"error": str(e)})

        # ── /api/hf-explorer ──────────────────────────────────────────────────
        elif self.path.startswith("/api/hf-explorer"):
            from urllib.parse import urlparse, parse_qs, quote
            qs = parse_qs(urlparse(self.path).query)
            query = qs.get("query", [""])[0].strip() or qs.get("q", [""])[0].strip()
            filter_tag = qs.get("filter", [""])[0].strip()
            sort = qs.get("sort", ["downloads"])[0].strip()
            limit = min(50, max(1, int(qs.get("limit", ["20"])[0])))

            env = load_env_file()
            hf_token = env.get("VITE_HF_TOKEN", "") or _state["hf_token"]

            params = [
                f"limit={limit}",
                f"sort={quote(sort)}",
                "direction=-1",
            ]
            if query:
                params.append(f"search={quote(query)}")
            if filter_tag and filter_tag != "All":
                params.append(f"filter={quote(filter_tag)}")

            hf_url = f"https://huggingface.co/api/models?{'&'.join(params)}"

            try:
                headers = {"User-Agent": "SimplePod-ModelCalculator/1.0"}
                if hf_token:
                    headers["Authorization"] = f"Bearer {hf_token}"

                r = requests.get(hf_url, headers=headers, timeout=12)
                if r.status_code != 200:
                    self.send_json(r.status_code, {"error": f"HuggingFace API returned HTTP {r.status_code}"})
                    return

                hf_models = r.json()
                items = []
                for hm in hf_models[:limit]:
                    model_id = hm.get("modelId") or hm.get("id", "")
                    author = model_id.split("/")[0] if "/" in model_id else ""
                    model_name = model_id.split("/")[-1]
                    tags = hm.get("tags", [])

                    mtype = "checkpoints"
                    for t in tags:
                        if t in ("lora", "LoRA"): mtype = "loras"; break
                        if t in ("text-to-image", "diffusers", "stable-diffusion"): mtype = "checkpoints"; break
                        if t in ("text-generation", "gguf"): mtype = "unet"; break

                    # Fetch file list for top model files
                    files = []
                    try:
                        fr = requests.get(f"https://huggingface.co/api/models/{model_id}", headers=headers, timeout=6)
                        if fr.status_code == 200:
                            fdata = fr.json()
                            for s in fdata.get("siblings", []):
                                rfn = s.get("rfilename", "")
                                if any(rfn.endswith(ext) for ext in (".safetensors", ".ckpt", ".pt", ".bin", ".gguf", ".onnx", ".pth")):
                                    fsize = s.get("size", 0)
                                    mb = fsize / (1024 * 1024) if fsize else 0
                                    size_str = f"{mb/1024:.2f} GB" if mb >= 1024 else (f"{mb:.2f} MB" if mb > 0 else "Unknown")
                                    files.append({
                                        "name": rfn,
                                        "size": size_str,
                                        "sizeBytes": fsize,
                                        "downloadUrl": f"https://huggingface.co/{model_id}/resolve/main/{rfn}",
                                    })
                    except Exception:
                        pass

                    items.append({
                        "id": model_id,
                        "name": model_name,
                        "author": author,
                        "repoId": model_id,
                        "type": mtype,
                        "tags": tags[:6],
                        "downloads": hm.get("downloads", 0),
                        "likes": hm.get("likes", 0),
                        "files": files,
                        "url": f"https://huggingface.co/{model_id}",
                    })

                self.send_json(200, {
                    "items": items,
                    "count": len(items),
                })
            except Exception as e:
                print(f"[hf-explorer] Error: {e}")
                self.send_json(500, {"error": str(e)})




        else:
            self.send_response(404)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()


    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)

        # ── /api/save-tokens ──────────────────────────────────────────────────
        if self.path.startswith("/api/save-tokens"):
            try:
                data = json.loads(post_data)
                hf_token = data.get("hfToken", "").strip()
                civitai_token = data.get("civitaiToken", "").strip()

                save_env_file({
                    "VITE_HF_TOKEN": hf_token,
                    "VITE_CIVITAI_TOKEN": civitai_token,
                })

                # Update in-memory tokens too
                _state["hf_token"] = hf_token
                _state["civitai_token"] = civitai_token

                print(f"[tokens] Saved to .env — HF: {'set' if hf_token else 'cleared'}, CivitAI: {'set' if civitai_token else 'cleared'}")
                self.send_json(200, {"status": "saved"})
            except Exception as e:
                self.send_json(500, {"error": str(e)})

        # ── /api/resolve-civitai-names ─────────────────────────────────────────
        elif self.path.startswith("/api/resolve-civitai-names"):
            try:
                data = json.loads(post_data)
                target_models = data.get("models", [])
                env = load_env_file()
                civitai_token = env.get("VITE_CIVITAI_TOKEN", "") or _state.get("civitai_token", "")
                
                resolved = {}
                with requests.Session() as session:
                    for m in target_models:
                        m_id = m.get("id")
                        url = m.get("url", "")
                        name = m.get("name", "")
                        
                        if not url or ("civitai.com" not in url and "civitai.red" not in url):
                            continue
                        
                        # Needs resolution if name is missing, numeric ID, or starts with civitai_
                        if not name or re.match(r'^\d+$', str(name)) or str(name).startswith('civitai_'):
                            vid_match = re.search(r'/models/(\d+)', url)
                            if vid_match:
                                version_id = vid_match.group(1)
                                real_name = get_civitai_model_name(version_id, civitai_token, session)
                                if real_name:
                                    resolved[m_id] = real_name
                                    update_cache_entry(url, name=real_name)
                                    print(f"[civitai-resolve] {version_id} -> {real_name}")

                self.send_json(200, {"resolved": resolved, "count": len(resolved)})
            except Exception as e:
                print(f"[civitai-resolve] Error: {e}")
                self.send_json(500, {"error": str(e)})


        # ── /api/check-size ───────────────────────────────────────────────────
        elif self.path.startswith("/api/check-size"):
            try:
                data = json.loads(post_data)
                url = data.get("url", "")
                env = load_env_file()
                hf_token = data.get("hfToken") or env.get("VITE_HF_TOKEN", "") or _state["hf_token"]
                civitai_token = data.get("civitaiToken") or env.get("VITE_CIVITAI_TOKEN", "") or _state["civitai_token"]

                size_str = "Unknown"
                if url and url.startswith("http") and "search?q=" not in url:
                    req_headers = {"User-Agent": "SimplePod-ModelCalculator/1.0"}
                    if hf_token and "huggingface.co" in url:
                        req_headers["Authorization"] = f"Bearer {hf_token}"
                    if civitai_token and ("civitai.com" in url or "civitai.red" in url):
                        req_headers["Authorization"] = f"Bearer {civitai_token}"
                        if "token=" not in url:
                            sep = "&" if "?" in url else "?"
                            url = f"{url}{sep}token={civitai_token}"

                    # Method A: Try HEAD request
                    try:
                        r = requests.head(url, headers=req_headers, allow_redirects=True, timeout=8)
                        if "Content-Length" in r.headers:
                            total = int(r.headers["Content-Length"])
                            mb = total / (1024 * 1024)
                            size_str = f"{mb/1024:.2f} GB" if mb >= 1024 else f"{mb:.2f} MB"
                    except Exception as e:
                        print(f"[size-check] HEAD failed for {url[:50]}: {e}")

                    # Method B: Range request fallback if HEAD failed
                    if size_str == "Unknown":
                        try:
                            r2 = requests.get(
                                url,
                                headers={**req_headers, "Range": "bytes=0-10"},
                                allow_redirects=True,
                                timeout=8,
                            )
                            cr = r2.headers.get("Content-Range")
                            if cr and "/" in cr:
                                total = int(cr.split("/")[-1])
                                mb = total / (1024 * 1024)
                                size_str = f"{mb/1024:.2f} GB" if mb >= 1024 else f"{mb:.2f} MB"
                        except Exception as e:
                            print(f"[size-check] Range request failed: {e}")

                    # Method C: CivitAI Model Version API fallback
                    if size_str == "Unknown" and ("civitai.com" in url or "civitai.red" in url):
                        vid_match = re.search(r'/models/(\d+)', url)
                        if vid_match:
                            vid = vid_match.group(1)
                            try:
                                civ_headers = {"User-Agent": "SimplePod-ModelCalculator/1.0"}
                                if civitai_token:
                                    civ_headers["Authorization"] = f"Bearer {civitai_token}"
                                api_url = f"https://civitai.com/api/v1/model-versions/{vid}"
                                r_civ = requests.get(api_url, headers=civ_headers, timeout=8)
                                if r_civ.status_code == 200:
                                    cdata = r_civ.json()
                                    files = cdata.get("files", [])
                                    primary = next((f for f in files if f.get("primary")), files[0] if files else None)
                                    if primary and primary.get("sizeKB"):
                                        mb = primary["sizeKB"] / 1024
                                        size_str = f"{mb/1024:.2f} GB" if mb >= 1024 else f"{mb:.2f} MB"
                            except Exception as e:
                                print(f"[size-check] CivitAI API failed: {e}")

                    # Method D: HuggingFace API fallback
                    if size_str == "Unknown" and "huggingface.co" in url:
                        # Extract repo and filename from HF URL
                        # e.g. https://huggingface.co/repo/owner/resolve/main/filename.safetensors
                        clean_url = url.split("?")[0]
                        parts = clean_url.split("/")
                        for marker in ("resolve", "blob", "raw"):
                            if marker in parts:
                                idx = parts.index(marker)
                                if idx >= 4:
                                    repo_id = "/".join(parts[3:idx])
                                    fname = "/".join(parts[idx+2:])
                                    try:
                                        hf_headers = {"User-Agent": "SimplePod-ModelCalculator/1.0"}
                                        if hf_token:
                                            hf_headers["Authorization"] = f"Bearer {hf_token}"
                                        r_hf = requests.get(f"https://huggingface.co/api/models/{repo_id}", headers=hf_headers, timeout=8)
                                        if r_hf.status_code == 200:
                                            hdata = r_hf.json()
                                            for sib in hdata.get("siblings", []):
                                                if sib.get("rfilename") == fname and sib.get("size"):
                                                    mb = sib["size"] / (1024 * 1024)
                                                    size_str = f"{mb/1024:.2f} GB" if mb >= 1024 else f"{mb:.2f} MB"
                                                    break
                                    except Exception as e:
                                        print(f"[size-check] HF API failed: {e}")

                if size_str and size_str != "Unknown":
                    update_cache_entry(url, size=size_str)

                self.send_json(200, {"url": url, "size": size_str})
            except Exception as e:
                self.send_json(500, {"error": str(e)})

        # ── /api/analyze-links ───────────────────────────────────────────────
        elif self.path.startswith("/api/analyze-links"):
            try:
                data = json.loads(post_data) if post_data else {}
                models = data.get("models", [])
                master_models = parse_model_list_txt(MODEL_LIST_TXT)
                cache = load_model_cache()

                issues = []
                valid_count = 0
                total_audited = len(models)
                flagged_ids = set()

                name_map = {}
                url_map = {}

                for m in models:
                    mid = m.get("id") or m.get("name") or ""
                    raw_name = (m.get("name") or "").strip()
                    raw_url = (m.get("url") or "").strip()

                    clean_n = raw_name.lower()
                    clean_u = raw_url.lower()

                    if clean_n and clean_n not in ("unnamed model", "model.safetensors"):
                        name_map.setdefault(clean_n, []).append(m)
                    if clean_u:
                        url_map.setdefault(clean_u, []).append(m)

                # Check for Duplicate Names with DIFFERENT URLs (Stale Cached Names)
                for lower_name, models_with_name in name_map.items():
                    if len(models_with_name) > 1:
                        distinct_urls = set(m.get("url", "").strip().lower() for m in models_with_name if m.get("url"))
                        if len(distinct_urls) > 1:
                            for m in models_with_name:
                                mid = m.get("id")
                                murl = (m.get("url") or "").strip()
                                if not murl or mid in flagged_ids:
                                    continue
                                flagged_ids.add(mid)

                                true_name = ""
                                if "huggingface.co" in murl:
                                    try:
                                        parts = [p for p in murl.split("?")[0].split("/") if p]
                                        if parts and re.search(r'\.(safetensors|ckpt|pt|bin|onnx|pth|gguf)$', parts[-1], re.I):
                                            true_name = parts[-1]
                                    except Exception:
                                        pass

                                clean_key, _ = extract_token_from_url(murl.replace("civitai.red", "civitai.com"))
                                cached = cache.get(clean_key)
                                if cached and cached.get("name") and cached["name"].lower() != lower_name:
                                    true_name = cached["name"]

                                issues.append({
                                    "id": mid,
                                    "name": m.get("name", "Unnamed Model"),
                                    "folder": (m.get("folder") or "checkpoints").replace("models/", ""),
                                    "type": "stale_name",
                                    "currentUrl": murl,
                                    "suggestedUrl": murl,
                                    "suggestedSize": m.get("size") or "",
                                    "suggestedName": true_name or "",
                                    "confidence": "High",
                                    "note": "Same name found on different URLs — past caching mismatch",
                                })

                # Check for Exact Duplicate Links
                for lower_url, models_with_url in url_map.items():
                    if len(models_with_url) > 1:
                        for m in models_with_url[1:]:
                            mid = m.get("id")
                            if mid in flagged_ids:
                                continue
                            flagged_ids.add(mid)

                            issues.append({
                                "id": mid,
                                "name": m.get("name", "Unnamed Model"),
                                "folder": (m.get("folder") or "checkpoints").replace("models/", ""),
                                "type": "duplicate_link",
                                "currentUrl": m.get("url", ""),
                                "suggestedUrl": "",
                                "suggestedSize": "",
                                "suggestedName": "",
                                "confidence": "High",
                                "note": "Duplicate link entry in table",
                            })

                for m in models:
                    mid = m.get("id") or m.get("name") or ""
                    if mid in flagged_ids:
                        continue

                    mname = m.get("name", "Unnamed Model")
                    mfolder = (m.get("folder") or "checkpoints").replace("models/", "")
                    murl = (m.get("url") or "").strip()

                    if not murl:
                        clean_name = mname.lower().replace(".safetensors", "").replace(".ckpt", "")
                        match = next((cat for cat in master_models if cat.get("url") and not cat["url"].startswith("http") and clean_name in cat.get("name", "").lower()), None)
                        issues.append({
                            "id": mid,
                            "name": mname,
                            "folder": mfolder,
                            "type": "missing",
                            "currentUrl": "",
                            "suggestedUrl": match.get("url", "") if match else "",
                            "suggestedSize": match.get("size", "") if match else "",
                            "confidence": "High" if match else "Low",
                        })
                    elif "/search?q=" in murl:
                        search_query = murl.split("?q=")[-1] if "?q=" in murl else mname
                        term = search_query.lower()
                        match = next((cat for cat in master_models if cat.get("url") and "search?q=" not in cat["url"] and term in cat["url"].lower()), None)
                        issues.append({
                            "id": mid,
                            "name": mname,
                            "folder": mfolder,
                            "type": "search",
                            "currentUrl": murl,
                            "suggestedUrl": match.get("url", "") if match else "",
                            "suggestedSize": match.get("size", "") if match else "",
                            "confidence": "High" if match else "Medium",
                        })
                    elif murl.startswith("http"):
                        valid_count += 1
                        is_name_placeholder = not mname or re.match(r'^\d+$', str(mname)) or str(mname).startswith("civitai_") or str(mname).startswith("UTF")
                        is_size_unknown = not m.get("size") or m.get("size") == "Unknown"
                        if is_name_placeholder or is_size_unknown:
                            issues.append({
                                "id": mid,
                                "name": mname,
                                "folder": mfolder,
                                "type": "name" if is_name_placeholder else "size",
                                "currentUrl": murl,
                                "suggestedUrl": murl,
                                "suggestedSize": m.get("size") if m.get("size") != "Unknown" else "",
                                "suggestedName": "",
                                "confidence": "High",
                            })
                    else:
                        issues.append({
                            "id": mid,
                            "name": mname,
                            "folder": mfolder,
                            "type": "broken",
                            "currentUrl": murl,
                            "suggestedUrl": "",
                            "suggestedSize": "",
                            "confidence": "Low",
                        })

                health_score = round((valid_count / total_audited) * 100) if total_audited > 0 else 100
                self.send_json(200, {
                    "healthScore": health_score,
                    "validCount": valid_count,
                    "totalAudited": total_audited,
                    "issues": issues,
                })
            except Exception as e:
                self.send_json(500, {"error": str(e)})

        # ── /api/save-models ──────────────────────────────────────────────────
        elif self.path.startswith("/api/save-models"):
            try:
                data = json.loads(post_data)
                models_list = data.get("models", [])
                # Re-read env tokens so civitai URLs get the token appended
                env = load_env_file()
                civitai_tok = env.get("VITE_CIVITAI_TOKEN", "") or _state["civitai_token"]

                for m in models_list:
                    if m.get("url"):
                        update_cache_entry(m.get("url"), size=m.get("size"), name=m.get("name"), folder=m.get("folder"))


                lines = [
                    "# ========================================================",
                    "# SIMPLEPOD MASTER COMFYUI MODEL DOWNLOAD LIST",
                    "# Updated via SimplePod Model Calculator Web Interface",
                    "# ========================================================\n",
                ]

                for m in models_list:
                    url = m.get("url")
                    # Accept either `folder` or `models/folder`, but write paths
                    # relative to ComfyUI's models root to avoid `models/models/...`.
                    folder = str(m.get("folder", "checkpoints")).replace("\\", "/").strip("/ ")
                    if folder.lower().startswith("models/"):
                        folder = folder[7:]
                    folder = folder or "checkpoints"
                    name = m.get("name")
                    if not url:
                        continue
                    # Append civitai token to civitai.com URLs if present
                    if civitai_tok and "civitai.com" in url and "token=" not in url:
                        sep = "&" if "?" in url else "?"
                        url = f"{url}{sep}token={civitai_tok}"
                    if name and name != os.path.basename(url.split("?")[0]):
                        lines.append(f"{url} {folder} {name}")
                    else:
                        lines.append(f"{url} {folder}")

                txt_content = "\n".join(lines)
                for path in (DOWNLOAD_TXT, MODEL_LIST_TXT):
                    with open(path, "w", encoding="utf-8") as f:
                        f.write(txt_content)

                print(f"[save] Wrote {len(models_list)} models to download.txt & model-list.txt")
                self.send_json(200, {"status": "success", "count": len(models_list)})
            except Exception as e:
                self.send_json(500, {"error": str(e)})

        else:
            self.send_response(404)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), SizeCheckerHandler)
    print(f"SimplePod Backend Server running on http://127.0.0.1:{PORT}")
    print(f"  -> GET  /api/get-tokens    -- read tokens from .env")
    print(f"  -> POST /api/save-tokens   -- write tokens to .env")
    print(f"  -> POST /api/check-size    -- proxy size fetch with auth")
    print(f"  -> POST /api/save-models   -- write download.txt & model-list.txt")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
