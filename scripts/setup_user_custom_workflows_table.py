import psycopg2
import os

sql = """
-- Create user_custom_workflows table if it does not exist
CREATE TABLE IF NOT EXISTS public.user_custom_workflows (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'CUSTOM',
    models JSONB DEFAULT '[]'::jsonb,
    raw_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, id)
);

-- Enable RLS
ALTER TABLE public.user_custom_workflows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can read own or master admin custom workflows" ON public.user_custom_workflows;
DROP POLICY IF EXISTS "Users can manage own custom workflows" ON public.user_custom_workflows;

-- RLS Policies
CREATE POLICY "Users can read own or master admin custom workflows" ON public.user_custom_workflows
    FOR SELECT USING (
        auth.uid() = user_id OR
        user_id = public.get_master_admin_id()
    );

CREATE POLICY "Users can manage own custom workflows" ON public.user_custom_workflows
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
    cur.execute(sql)
    conn.commit()
    print('SUCCESS! Created user_custom_workflows table and RLS policies in Supabase DB.')
    cur.close()
    conn.close()
except Exception as e:
    print('ERROR:', type(e).__name__, str(e))
