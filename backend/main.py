from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import time
import os
from dotenv import load_dotenv
import httpx
from routers import auth, attendance, analytics

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from database import get_supabase
        client = get_supabase()

        # Connectivity test with Retry Logic
        max_retries = 3
        for attempt in range(max_retries):
            try:
                client.table("users").select("id").limit(1).execute()
                print("✅ Supabase connection verified successfully.")
                break
            except Exception as query_err:
                err_msg = str(query_err)
                if "does not exist" in err_msg:
                    print("✅ Supabase reachable, but 'users' table is missing (This is OK).")
                    break
                
                print(f"⚠️  Connection attempt {attempt + 1} failed... (Retrying in 2s)")
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                
                if "10060" in err_msg or "timed out" in err_msg.lower():
                    print(f"❌ PERMANENT NETWORK BLOCK: {err_msg}")
                else:
                    print(f"ℹ️  Supabase connectivity status: {err_msg}")

    except Exception as e:
        print(f"\n❌ SUPABASE CONNECTION ERROR: {e}")
    yield

app = FastAPI(title="Attendance Tracker API", version="1.0.0", lifespan=lifespan)

# ------------------ EXCEPTION HANDLERS ------------------

@app.exception_handler(httpx.HTTPError)
async def supabase_error_handler(request: Request, exc: httpx.HTTPError):
    print(f"DEBUG: Supabase Request Error: {type(exc).__name__} - {str(exc)}")
    
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "detail": "Backend could not connect to Supabase."
        },
    )

try:
    from postgrest.exceptions import APIError

    @app.exception_handler(APIError)
    async def postgrest_error_handler(request: Request, exc: APIError):
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": f"Database Error: {exc.message}"},
        )
except ImportError:
    pass

# ------------------ CORS CONFIG ------------------

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "https://college-project-726a.vercel.app,http://localhost:3000,http://localhost:5173"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------ 🔥 FIX: HANDLE PREFLIGHT ------------------

@app.options("/{full_path:path}")
async def preflight_handler(full_path: str):
    return JSONResponse(content={"message": "OK"})

# ------------------ ROUTERS ------------------

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(attendance.router, prefix="/api/attendance", tags=["Attendance"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])

# ------------------ ROOT ------------------

@app.get("/")
async def root():
    return {"message": "Attendance Tracker API Running", "status": "ok"}

# ------------------ RUN ------------------

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)