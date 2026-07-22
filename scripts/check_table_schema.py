import psycopg2

conn = psycopg2.connect(
    host='db.fgrmbmltnqinmtgzrbpi.supabase.co',
    port=5432, dbname='postgres', user='postgres',
    password='Mycomfyui!!@@751'
)
cur = conn.cursor()
cur.execute("""
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_model_overrides';
""")
cols = cur.fetchall()
print("user_model_overrides columns:", cols)

# Add url column if missing
col_names = [c[0] for c in cols]
if 'url' not in col_names:
    print("Adding 'url' column to user_model_overrides...")
    cur.execute("ALTER TABLE user_model_overrides ADD COLUMN url TEXT;")
    conn.commit()
    print("Added 'url' column successfully!")
else:
    print("'url' column already exists.")

cur.close()
conn.close()
