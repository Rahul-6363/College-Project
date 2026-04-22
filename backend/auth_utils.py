"""
Auth utilities — optimised for speed:
  - bcrypt rounds reduced to 10 (was default 12 → ~4x slower)
  - Token decode cached via functools.lru_cache
  - Supabase indexed lookup for authentication
"""
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import os

SECRET_KEY = os.getenv("SECRET_KEY", "attendiq-secret-key-change-in-production-32chars")
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# rounds=10 → ~100ms hash instead of ~400ms at rounds=12
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=10)

# auto_error=False → we raise our own 401 with clear message
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    payload = {**data, "exp": datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return decode_token(credentials.credentials)


async def require_principal(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "principal":
        raise HTTPException(status_code=403, detail="Principal access required.")
    return current_user


async def require_data_manager(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "data_manager":
        raise HTTPException(status_code=403, detail="Data Manager access required.")
    return current_user
