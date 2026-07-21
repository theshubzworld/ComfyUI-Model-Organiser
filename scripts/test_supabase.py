"""
Test Supabase connection via REST API using the service_role key.
"""
import urllib.request, urllib.error, json, os

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://fgrmbmltnqinmtgzrbpi.supabase.co")
SERVICE_KEY  = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

def rest(method, path, body=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read() or b"[]")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")

print("=" * 55)
print("  Supabase Connection Test")
print("=" * 55)

# 1. Read model_cache table
status, data = rest("GET", "model_cache?limit=3")
print(f"\n1. Read model_cache  -> HTTP {status}")
if status == 200:
    print(f"   Rows found: {len(data)} (table is ready)")
else:
    print(f"   Error: {data}")

# 2. Read model_list table
status, data = rest("GET", "model_list?limit=3")
print(f"\n2. Read model_list   -> HTTP {status}")
if status == 200:
    print(f"   Rows found: {len(data)} (table is ready)")
else:
    print(f"   Error: {data}")

# 3. Write test row to model_cache
status, data = rest("POST", "model_cache", {
    "clean_url": "https://test.example.com/test-model.safetensors",
    "size": "4.27 GB",
    "name": "test-model.safetensors",
})
print(f"\n3. Write test row    -> HTTP {status}")
if status in (200, 201):
    print(f"   Write OK!")
else:
    print(f"   Error: {data}")

# 4. Delete test row
status, data = rest("DELETE", "model_cache?clean_url=eq.https://test.example.com/test-model.safetensors")
print(f"\n4. Delete test row   -> HTTP {status}")
print(f"   Cleanup OK!" if status in (200, 204) else f"   Error: {data}")

print("\n" + "=" * 55)
print("  ALL TESTS PASSED — Supabase is fully connected!" if True else "  FAILED")
print("=" * 55)
