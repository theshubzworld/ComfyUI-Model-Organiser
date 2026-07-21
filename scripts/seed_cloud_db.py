"""
Seed all 350 models from master-model-list.txt and 341 cached sizes/names
from model_cache.json into Supabase PostgreSQL database.
"""
import os
import json
import base64
import psycopg2

def model_id(url):
    try:
        return base64.b64encode(url.encode('utf-8')).decode('utf-8')[:32]
    except Exception:
        return url[-32:]

def clean_url(url):
    if not url:
        return url
    return (
        url.replace('civitai.red', 'civitai.com')
        .replace('?token=', '&token=')
        .split('token=')[0]
        .rstrip('?&')
    )

def parse_line(line):
    line = line.strip()
    if not line or line.startswith('#'):
        return None
    parts = line.split()
    if len(parts) < 2:
        return None
    url = parts[0]
    if not url.startswith('http'):
        return None
    folder = parts[1].replace('models/', '') if len(parts) > 1 else 'checkpoints'
    name = parts[2] if len(parts) > 2 else ''
    return {'url': url, 'folder': folder, 'name': name}

def seed():
    master_file = os.path.join('data', 'master-model-list.txt')
    cache_file = os.path.join('data', 'model_cache.json')

    if not os.path.exists(master_file):
        print(f"File not found: {master_file}")
        return

    # Parse models
    models = []
    with open(master_file, 'r', encoding='utf-8') as f:
        for line in f:
            m = parse_line(line)
            if m:
                models.append(m)

    print(f"Loaded {len(models)} models from {master_file}")

    # Parse cache
    cache = {}
    if os.path.exists(cache_file):
        with open(cache_file, 'r', encoding='utf-8') as f:
            raw_cache = json.load(f)
            for key, val in raw_cache.items():
                c_key = clean_url(key)
                if isinstance(val, dict):
                    cache[c_key] = val
                elif isinstance(val, str):
                    cache[c_key] = {'size': val}
    print(f"Loaded {len(cache)} cached items from {cache_file}")

    # Connect to Supabase DB
    conn = psycopg2.connect(
        host=os.getenv('SUPABASE_DB_HOST', 'db.fgrmbmltnqinmtgzrbpi.supabase.co'),
        port=int(os.getenv('SUPABASE_DB_PORT', 5432)),
        dbname=os.getenv('SUPABASE_DB_NAME', 'postgres'),
        user=os.getenv('SUPABASE_DB_USER', 'postgres'),
        password=os.getenv('SUPABASE_DB_PASSWORD', 'Mycomfyui!!@@751'),
        sslmode='require',
        connect_timeout=15
    )
    cur = conn.cursor()

    # 1. Seed model_list
    list_sql = """
    INSERT INTO model_list (id, url, name, folder, size, source)
    VALUES (%s, %s, %s, %s, %s, 'file')
    ON CONFLICT (id) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, model_list.name),
      folder = EXCLUDED.folder,
      size = COALESCE(EXCLUDED.size, model_list.size);
    """

    inserted_list = 0
    for m in models:
        mid = model_id(m['url'])
        c_key = clean_url(m['url'])
        cached = cache.get(c_key, {})
        size = cached.get('size', '')
        name = cached.get('name') or m['name'] or None
        cur.execute(list_sql, (mid, m['url'], name, m['folder'], size))
        inserted_list += 1

    conn.commit()
    print(f"Successfully seeded {inserted_list} models into Supabase model_list table!")

    # 2. Seed model_cache
    cache_sql = """
    INSERT INTO model_cache (clean_url, size, name, folder)
    VALUES (%s, %s, %s, %s)
    ON CONFLICT (clean_url) DO UPDATE SET
      size = COALESCE(EXCLUDED.size, model_cache.size),
      name = COALESCE(EXCLUDED.name, model_cache.name),
      folder = COALESCE(EXCLUDED.folder, model_cache.folder);
    """

    inserted_cache = 0
    for c_key, val in cache.items():
        size = val.get('size', '')
        name = val.get('name', '')
        folder = val.get('folder', '')
        cur.execute(cache_sql, (c_key, size or None, name or None, folder or None))
        inserted_cache += 1

    conn.commit()
    print(f"Successfully seeded {inserted_cache} items into Supabase model_cache table!")

    cur.close()
    conn.close()

if __name__ == '__main__':
    seed()
