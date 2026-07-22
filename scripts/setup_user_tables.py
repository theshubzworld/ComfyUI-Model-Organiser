import psycopg2
import os

schema_sql = """
CREATE TABLE IF NOT EXISTS user_selected_workflows (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_ids  TEXT[] NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_custom_models (
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  id         TEXT,
  name       TEXT,
  folder     TEXT,
  url        TEXT,
  size       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS user_model_overrides (
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id   TEXT,
  folder     TEXT,
  name       TEXT,
  size       TEXT,
  is_removed BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, model_id)
);

-- Enable RLS
ALTER TABLE user_selected_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_custom_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_model_overrides ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies
DROP POLICY IF EXISTS "Users can manage their own selected workflows" ON user_selected_workflows;
CREATE POLICY "Users can manage their own selected workflows" ON user_selected_workflows FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own custom models" ON user_custom_models;
CREATE POLICY "Users can manage their own custom models" ON user_custom_models FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own model overrides" ON user_model_overrides;
CREATE POLICY "Users can manage their own model overrides" ON user_model_overrides FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
"""

verify_sql = """
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN ('user_selected_workflows', 'user_custom_models', 'user_model_overrides')
"""

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
