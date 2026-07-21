import psycopg2

schema_sql = """
CREATE TABLE IF NOT EXISTS model_cache (
  clean_url   TEXT PRIMARY KEY,
  size        TEXT,
  name        TEXT,
  folder      TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS model_list (
  id          TEXT PRIMARY KEY,
  url         TEXT NOT NULL,
  name        TEXT,
  folder      TEXT DEFAULT 'checkpoints',
  size        TEXT,
  source      TEXT DEFAULT 'file',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_model_list_url ON model_list (url);
CREATE INDEX IF NOT EXISTS idx_model_cache_url ON model_cache (clean_url);
"""

verify_sql = """
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN ('model_cache','model_list')
"""

import os

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
    cur.execute(schema_sql)
    conn.commit()
    cur.execute(verify_sql)
    tables = [r[0] for r in cur.fetchall()]
    print('SUCCESS! Tables created:', tables)
    cur.close()
    conn.close()
except Exception as e:
    print('ERROR:', type(e).__name__, str(e))
