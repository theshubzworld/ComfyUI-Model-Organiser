import os
import shutil
import sys
import subprocess
import time

# Ensure huggingface_hub is installed
try:
    from huggingface_hub import hf_hub_download
except ImportError:
    print("huggingface_hub not found. Installing...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-U", "huggingface_hub"])
    from huggingface_hub import hf_hub_download


# --------------------------------------------------------
# Configuration
# --------------------------------------------------------

LIST_FILE = "/workspace/Files/downloader/download.txt"
MODELS_BASE = "/workspace/ComfyUI/models"
MAX_RETRIES = 3


# --------------------------------------------------------
# Stats
# --------------------------------------------------------

downloaded = 0
skipped = 0
redownloaded = 0
failed = 0


# --------------------------------------------------------
# Read download list
# --------------------------------------------------------

with open(LIST_FILE, "r", encoding="utf-8") as f:
    lines = f.readlines()


# --------------------------------------------------------
# Process each line
# --------------------------------------------------------

for line in lines:

    line = line.strip()

    if not line or line.startswith("#"):
        continue

    parts = line.split()

    if len(parts) < 2:
        print(f"Skipping invalid line:\n{line}\n")
        continue

    hf_url = parts[0]
    target_folder = parts[1].strip("/ ")
    new_filename = parts[2] if len(parts) > 2 else None

    dest_folder = os.path.join(MODELS_BASE, target_folder)
    os.makedirs(dest_folder, exist_ok=True)

    # ----------------------------------------------------
    # Parse HF URL
    # ----------------------------------------------------

    url_parts = hf_url.split("/")

    if "resolve" not in url_parts:
        print(f"Invalid Hugging Face URL:\n{hf_url}\n")
        failed += 1
        continue

    idx = url_parts.index("resolve")

    repo_id = "/".join(url_parts[3:idx])
    revision = url_parts[idx + 1]
    filename_in_repo = "/".join(url_parts[idx + 2:])

    repo_name = repo_id.split("/")[-1]

    original_name = os.path.basename(filename_in_repo)
    extension = os.path.splitext(original_name)[1]

    # ----------------------------------------------------
    # Final filename
    # ----------------------------------------------------

    if new_filename:
        if os.path.splitext(new_filename)[1]:
            final_name = new_filename
        else:
            final_name = new_filename + extension
    else:
        if original_name.startswith("diffusion_pytorch_model"):
            final_name = repo_name + extension
        else:
            final_name = original_name

    dest_path = os.path.join(dest_folder, final_name)

    # ----------------------------------------------------
    # Download with retries
    # ----------------------------------------------------

    success = False

    for attempt in range(1, MAX_RETRIES + 1):

        try:

            cached_file = hf_hub_download(
                repo_id=repo_id,
                filename=filename_in_repo,
                revision=revision,
            )

            expected_size = os.path.getsize(cached_file)

            if os.path.exists(dest_path):

                existing_size = os.path.getsize(dest_path)

                if existing_size == expected_size and existing_size > 0:
                    print(f"✔ Already exists ({existing_size / 1024 / 1024:.2f} MB)")
                    print(dest_path)
                    print()
                    skipped += 1
                    success = True
                    break

                print("⚠ Existing file is invalid.")
                print(f"Expected : {expected_size}")
                print(f"Found    : {existing_size}")
                print("Re-downloading...\n")

                os.remove(dest_path)
                redownloaded += 1

            shutil.copy2(cached_file, dest_path)

            final_size = os.path.getsize(dest_path)

            if final_size != expected_size:
                raise RuntimeError(
                    f"Copied file size mismatch ({final_size} != {expected_size})"
                )

            print(f"✅ Downloaded:")
            print(dest_path)
            print()

            downloaded += 1
            success = True
            break

        except Exception as e:

            print(f"Attempt {attempt}/{MAX_RETRIES} failed:")
            print(e)
            print()

            if attempt < MAX_RETRIES:
                time.sleep(2)

    if not success:
        print(f"❌ Failed permanently:\n{hf_url}\n")
        failed += 1


# --------------------------------------------------------
# Summary
# --------------------------------------------------------

print("=" * 60)
print("Download Summary")
print("=" * 60)

print(f"Downloaded    : {downloaded}")
print(f"Skipped       : {skipped}")
print(f"Re-downloaded : {redownloaded}")
print(f"Failed        : {failed}")
print("=" * 60)