"""
Fast Bulk Sync for Supabase model_list & model_cache tables
"""
import os
import psycopg2
from psycopg2.extras import execute_values

TXT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "master-model-list.txt")

with open(TXT_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

models = {}
for idx, line in enumerate(lines):
    raw = line.strip()
    if not raw or raw.startswith("#"):
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

        clean_url = url.replace("civitai.red", "civitai.com").split("?")[0]
        folder = folder_path.replace('\\', '/').split('/')[0]
        source = "HuggingFace" if "huggingface.co" in url else ("CivitAI" if "civitai" in url else "Custom")

        models[clean_url] = (f"master_{idx}", clean_url, folder, source, filename)

model_list_rows = list(models.values())
print(f"Loaded {len(model_list_rows)} unique models from master-model-list.txt for fast bulk sync.")

password = os.getenv('SUPABASE_DB_PASSWORD')

try:
    conn = psycopg2.connect(
        host=os.getenv('SUPABASE_DB_HOST', 'db.fgrmbmltnqinmtgzrbpi.supabase.co'),
        port=int(os.getenv('SUPABASE_DB_PORT', 5432)),
        dbname=os.getenv('SUPABASE_DB_NAME', 'postgres'),
        user=os.getenv('SUPABASE_DB_USER', 'postgres'),
        password=password,
        sslmode='require',
        connect_timeout=10
    )
    cur = conn.cursor()

    # 1. Bulk Upsert into model_list
    execute_values(
        cur,
        """
        INSERT INTO public.model_list (id, url, folder, source, name)
        VALUES %s
        ON CONFLICT (id) DO UPDATE 
        SET url = EXCLUDED.url, folder = EXCLUDED.folder, source = EXCLUDED.source, name = EXCLUDED.name;
        """,
        model_list_rows
    )

    # 2. Bulk Upsert into model_cache
    cache_rows = [(m[1], m[4], m[2]) for m in model_list_rows]
    execute_values(
        cur,
        """
        INSERT INTO public.model_cache (clean_url, name, folder)
        VALUES %s
        ON CONFLICT (clean_url) DO UPDATE 
        SET name = EXCLUDED.name, folder = EXCLUDED.folder, updated_at = NOW();
        """,
        cache_rows
    )

    conn.commit()
    print(f"Successfully bulk synced Supabase: {len(models)} rows in model_list & model_cache!")
    cur.close()
    conn.close()
except Exception as e:
    print("Supabase DB sync error:", type(e).__name__, str(e))
