import psycopg2
import os

fix_sql = """
-- 1. Create SECURITY DEFINER function to safely fetch Master Admin UUID without auth.users permission errors
CREATE OR REPLACE FUNCTION public.get_master_admin_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM auth.users WHERE lower(email) = 'shubzveo@gmail.com' LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_master_admin_id() TO authenticated, anon, service_role;


-- 2. Update user_selected_workflows RLS Policies
DROP POLICY IF EXISTS "Users can read own rows or master admin workflows" ON user_selected_workflows;
DROP POLICY IF EXISTS "Users can insert/update own workflows" ON user_selected_workflows;
DROP POLICY IF EXISTS "Users can manage their own selected workflows" ON user_selected_workflows;

CREATE POLICY "Users can read own rows or master admin workflows" ON user_selected_workflows
  FOR SELECT USING (
    auth.uid() = user_id OR 
    user_id = public.get_master_admin_id()
  );

CREATE POLICY "Users can insert/update own workflows" ON user_selected_workflows
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- 3. Update user_custom_models RLS Policies
DROP POLICY IF EXISTS "Users can read own rows or master admin custom models" ON user_custom_models;
DROP POLICY IF EXISTS "Users can read own, master admin, or public custom models" ON user_custom_models;
DROP POLICY IF EXISTS "Users can insert/update own custom models" ON user_custom_models;
DROP POLICY IF EXISTS "Users can manage their own custom models" ON user_custom_models;

CREATE POLICY "Users can read own, master admin, or public custom models" ON user_custom_models
  FOR SELECT USING (
    auth.uid() = user_id OR 
    is_public = TRUE OR
    user_id = public.get_master_admin_id()
  );

CREATE POLICY "Users can insert/update own custom models" ON user_custom_models
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- 4. Update user_model_overrides RLS Policies
DROP POLICY IF EXISTS "Users can read own rows or master admin overrides" ON user_model_overrides;
DROP POLICY IF EXISTS "Users can insert/update own overrides" ON user_model_overrides;
DROP POLICY IF EXISTS "Users can manage their own model overrides" ON user_model_overrides;

CREATE POLICY "Users can read own rows or master admin overrides" ON user_model_overrides
  FOR SELECT USING (
    auth.uid() = user_id OR 
    user_id = public.get_master_admin_id()
  );

CREATE POLICY "Users can insert/update own overrides" ON user_model_overrides
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
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
    cur.execute(fix_sql)
    conn.commit()
    print('SUCCESS! Fixed 403 permission errors by wrapping Master Admin lookup in SECURITY DEFINER function.')
    cur.close()
    conn.close()
except Exception as e:
    print('ERROR:', type(e).__name__, str(e))
