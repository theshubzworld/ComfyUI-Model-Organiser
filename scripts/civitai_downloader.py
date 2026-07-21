import os
import sys
import requests
import zipfile
import re
import urllib.parse

# Install tqdm automatically if missing
try:
    from tqdm import tqdm
except ImportError:
    print("tqdm not found. Installing...")
    os.system(f"{sys.executable} -m pip install tqdm")
    from tqdm import tqdm

# Path to your list file
list_file = "/workspace/Files/downloader/civitai_download.txt"

# Base folder for ComfyUI models
models_base = "/workspace/ComfyUI/models"

headers = {
    "User-Agent": "Mozilla/5.0"
}

with open(list_file, "r") as f:
    lines = f.readlines()

for line in lines:
    line = line.strip()

    # Skip comments and empty lines
    if not line or line.startswith("#"):
        continue

    parts = line.split()

    if len(parts) < 2:
        print(f"Skipping invalid line: {line}")
        continue

    url = parts[0]
    target_path = parts[1]

    # Check if the user provided a folder or a full path
    # Treat as a full path only if they explicitly provided an extension
    ext = os.path.splitext(target_path)[1]
    is_full_path = ext.lower() in [".safetensors", ".ckpt", ".pt", ".bin", ".zip", ".pth", ".gguf"]

    try:
        print(f"\n⬇ Connecting...\n{url}")
        
        # Make the request first to get headers and actual filename
        response = requests.get(url, headers=headers, stream=True)
        response.raise_for_status()
        
        # Figure out the destination path
        if is_full_path:
            dest_path = os.path.join(models_base, target_path)
            dest_folder = os.path.dirname(dest_path)
        else:
            dest_folder = os.path.join(models_base, target_path)
            
            # Extract filename from header
            cd = response.headers.get("content-disposition", "")
            
            # CivitAI uses both standard and UTF-8 encoded filename headers
            match_utf8 = re.search(r'filename\*=UTF-8\'\'([^;]+)', cd, re.IGNORECASE)
            if match_utf8:
                filename = urllib.parse.unquote(match_utf8.group(1))
            else:
                match = re.search(r'filename="?([^";]+)"?', cd)
                if match:
                    filename = match.group(1)
                else:
                    filename = "downloaded_model.safetensors" # Fallback
                
            dest_path = os.path.join(dest_folder, filename)

        # Create folders automatically
        os.makedirs(dest_folder, exist_ok=True)

        # Skip if file already exists
        if os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
            print(f"✔ Already exists, skipping: {dest_path}")
            continue

        print(f"→ Saving to {dest_path}")

        # Download file with progress bar
        temp_path = dest_path + ".part"
        total_size = int(response.headers.get("content-length", 0))

        with open(temp_path, "wb") as f, tqdm(
            desc=os.path.basename(dest_path),
            total=total_size,
            unit="B",
            unit_scale=True,
            unit_divisor=1024,
        ) as bar:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)
                    bar.update(len(chunk))

        os.rename(temp_path, dest_path)
        print(f"✅ Finished: {dest_path}")

        # Auto extract ZIP files
        if dest_path.endswith(".zip"):
            print("📦 Extracting ZIP...")
            with zipfile.ZipFile(dest_path, 'r') as zip_ref:
                zip_ref.extractall(dest_folder)
            print("✔ Extraction complete")
            os.remove(dest_path)
            print("🗑️ ZIP file deleted")

    except Exception as e:
        print(f"❌ Failed: {url}")
        print(e)