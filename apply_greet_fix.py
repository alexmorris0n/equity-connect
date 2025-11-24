import os
from supabase import create_client, Client

# Initialize Supabase client
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

# Read migration file
with open("supabase/migrations/20251124_fix_greet_routing.sql", "r") as f:
    sql = f.read()

# Execute migration
try:
    result = supabase.rpc("exec_sql", {"sql": sql}).execute()
    print("✅ Migration applied successfully")
    print(f"Result: {result}")
except Exception as e:
    print(f"❌ Migration failed: {e}")
    # Try executing each statement separately
    statements = [s.strip() for s in sql.split(';') if s.strip()]
    for i, stmt in enumerate(statements):
        try:
            result = supabase.postgrest.rpc("query", {"query": stmt}).execute()
            print(f"✅ Statement {i+1} executed")
        except Exception as stmt_error:
            print(f"❌ Statement {i+1} failed: {stmt_error}")


