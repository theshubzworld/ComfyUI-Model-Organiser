import psycopg2
import os

schema_sql = """
-- Drop existing single-user policies
DROP POLICY IF EXISTS "Users can manage their own selected workflows" ON user_selected_workflows;
DROP POLICY IF EXISTS "Users can manage their own custom models" ON user_custom_models;
DROP POLICY IF EXISTS "Users can manage their own model overrides" ON user_model_overrides;

DROP POLICY IF EXISTS "Users can read own rows or master admin workflows" ON user_selected_workflows;
DROP POLICY IF EXISTS "Users can insert/update own workflows" ON user_selected_workflows;

-- 1. user_selected_workflows Policies
CREATE POLICY "Users can read own rows or master admin workflows" ON user_selected_workflows
  FOR SELECT USING (
    auth.uid() = user_id OR 
    user_id IN (SELECT id FROM auth.users WHERE lower(email) = 'shubzveo@gmail.com')
  );

CREATE POLICY "Users can insert/update own workflows" ON user_selected_workflows
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- 2. user_custom_models Policies
DROP POLICY IF EXISTS "Users can read own rows or master admin custom models" ON user_custom_models;
DROP POLICY IF EXISTS "Users can insert/update own custom models" ON user_custom_models;

CREATE POLICY "Users can read own rows or master admin custom models" ON user_custom_models
  FOR SELECT USING (
    auth.uid() = user_id OR 
    user_id IN (SELECT id FROM auth.users WHERE lower(email) = 'shubzveo@gmail.com')
  );

CREATE POLICY "Users can insert/update own custom models" ON user_custom_models
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- 3. user_model_overrides Policies
DROP POLICY IF EXISTS "Users can read own rows or master admin overrides" ON user_model_overrides;
DROP POLICY IF EXISTS "Users can insert/update own overrides" ON user_model_overrides;

CREATE POLICY "Users can read own rows or master admin overrides" ON user_model_overrides
  FOR SELECT USING (
    auth.uid() = user_id OR 
    user_id IN (SELECT id FROM auth.users WHERE lower(email) = 'shubzveo@gmail.com')
  );

CREATE POLICY "Users can insert/update own overrides" ON user_model_overrides
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
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
    print('SUCCESS! Master Admin RLS policies applied to user_selected_workflows, user_custom_models, and user_model_overrides.')
    cur.close()
    conn.close()
except Exception as e:
    print('ERROR:', type(e).__name__, str(e))
