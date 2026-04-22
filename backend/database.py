"""
Database connections.
- Supabase: user auth and attendance data
"""
from supabase import create_client, Client, ClientOptions
from fastapi import HTTPException
import os
from dotenv import load_dotenv

load_dotenv(override=True)
if os.getenv("MONGO_URL"):
    print("ℹ️  MONGO_URL found in .env but ignored; project is now Supabase-only.")

# Helper to clean environment variables (removes accidental quotes/spaces)
def _get_clean_env(key: str) -> str:
    val = str(os.getenv(key, "")).strip()
    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
        val = val[1:-1].strip()
    return val

# ── Supabase ──────────────────────────────────────────────────────────────────
SUPABASE_URL = _get_clean_env("SUPABASE_URL").strip().rstrip('/')
SUPABASE_KEY = _get_clean_env("SUPABASE_KEY")

_supabase: Client = None

def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise HTTPException(
                status_code=503,
                detail="Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY in .env"
            )

        # Explicitly set high timeouts for environments with slow handshakes
        opts = ClientOptions(
            postgrest_client_timeout=90, 
            storage_client_timeout=90
        )
        
        try:
            if not SUPABASE_URL.startswith("https://"):
                raise ValueError("SUPABASE_URL must start with https://")
                
            print(f"DEBUG: Initializing Supabase Client for {SUPABASE_URL[:30]}...")
            _supabase = create_client(SUPABASE_URL, SUPABASE_KEY, options=opts)
        except Exception as e:
            print(f"❌ Supabase Config Error: {e}")
            raise HTTPException(status_code=500, detail=f"Database configuration error: {str(e)}")
            
    return _supabase
