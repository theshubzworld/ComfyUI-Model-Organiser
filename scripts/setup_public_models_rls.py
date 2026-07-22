import psycopg2
import os

schema_sql = """
ALTER TABLE user_custom_models ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- Update RLS Policy to allow selecting public models
DROP POLICY IF EXISTS "Users can read own rows or master admin custom models" ON user_custom_models;
DROP POLICY IF EXISTS "Users can read own, master admin, or public custom models" ON user_custom_models;

CREATE POLICY "Users can read own, master admin, or public custom models" ON user_custom_models
  FOR SELECT USING (
    auth.uid() = user_id OR 
    is_public = TRUE OR
    user_id IN (SELECT id FROM auth.users WHERE lower(email) = 'shubzveo@gmail.com')
  );
"""

password = os.getenv('SUPABASE_DB_PASSWORD')

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
    print('SUCCESS! Added is_public column and updated RLS policies for user_custom_models.')
    cur.close()
    conn.close()
except Exception as e:
    print('ERROR:', type(e).__name__, str(e))
