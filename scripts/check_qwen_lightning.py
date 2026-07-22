import os, psycopg2

conn = psycopg2.connect(
    host='db.fgrmbmltnqinmtgzrbpi.supabase.co',
    port=5432, dbname='postgres', user='postgres',
    password='Mycomfyui!!@@751'
)
cur = conn.cursor()

# Check model_list
cur.execute("""
SELECT id, name, folder, url
FROM public.model_list
WHERE name ILIKE '%Qwen-Image-Lightning%'
   OR url ILIKE '%Qwen-Image-Lightning%'
LIMIT 10
""")
rows = cur.fetchall()
print("=== model_list ===")
for r in rows:
    print(r)

# Check model_cache
cur.execute("""
SELECT id, name, folder, clean_url
FROM public.model_cache
WHERE name ILIKE '%Qwen-Image-Lightning%'
   OR clean_url ILIKE '%Qwen-Image-Lightning%'
LIMIT 10
""")
rows = cur.fetchall()
print("=== model_cache ===")
for r in rows:
    print(r)

# Check any AIFSH entries
cur.execute("""
SELECT id, name, folder FROM public.model_list WHERE folder = 'AIFSH' LIMIT 20
""")
rows = cur.fetchall()
print("=== AIFSH entries in model_list ===")
for r in rows:
    print(r)

cur.close()
conn.close()
print("Done.")
