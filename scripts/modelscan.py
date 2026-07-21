import os
import requests

# ---------- BASE PATH ----------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_LIST_FILE = os.path.join(BASE_DIR, "model-list.txt")
OUTPUT_FILE = os.path.join(BASE_DIR, "model_report.txt")

# ---------- FILE EXTENSIONS ----------
VALID_EXT = (".safetensors", ".pth", ".gguf", ".onnx", ".patch")

# ---------- GET SIZE (FAST HEAD REQUEST) ----------
def get_size(url):
    try:
        r = requests.head(url, allow_redirects=True, timeout=10)

        if "Content-Length" in r.headers:
            total = int(r.headers["Content-Length"])
        else:
            return "Unknown"

        mb = total / (1024 * 1024)

        if mb > 1024:
            return f"{mb/1024:.2f} GB"
        return f"{mb:.2f} MB"

    except:
        return "Unknown"

# ---------- CLEAN TARGET ----------
def clean_target(target):
    if not target:
        return "Unknown"

    target = target.replace('"', '').strip()

    if target.lower().startswith("app\\"):
        target = target[4:]

    return target

# ---------- MAIN ----------
if not os.path.exists(MODEL_LIST_FILE):
    print("❌ model-list.txt not found")
    input("Press Enter...")
    exit()

print("Reading model-list.txt...\n")

seen = set()
results = []

with open(MODEL_LIST_FILE, "r", encoding="utf-8") as f:
    lines = f.readlines()

for line in lines:
    line = line.strip()

    # Skip empty or comments
    if not line or line.startswith("#"):
        continue

    parts = line.split()

    # ---------- FIND URL ----------
    url = None
    for p in parts:
        if p.startswith("http"):
            url = p
            break

    if not url:
        continue

    # ---------- FIND NAME ----------
    name = None
    for p in reversed(parts):
        if p.endswith(VALID_EXT):
            name = p
            break

    if not name:
        name = os.path.basename(url)

    # ---------- FIND TARGET ----------
    target = None
    for p in parts[1:]:
        if "/" in p or p.isalpha():
            target = p
            break

    if not target:
        target = "Unknown"

    target = clean_target(target)

    # ---------- DEDUP ----------
    if url in seen:
        continue
    seen.add(url)

    print(f"Checking: {name}")

    size = get_size(url)

    results.append((name, size, target, url))

# ---------- WRITE OUTPUT ----------
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    for name, size, target, url in results:
        f.write(f"Name: {name}\n")
        f.write(f"Size: {size}\n")
        f.write(f"SaveTo: {target}\n")
        f.write(f"Link: {url}\n\n")

print("\n✅ DONE")
print("Saved to:", OUTPUT_FILE)
input("Press Enter to exit...")