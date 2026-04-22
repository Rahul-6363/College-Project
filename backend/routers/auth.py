from fastapi import APIRouter, HTTPException, Depends, status
from models import UserCreate, UserLogin, Token, UserResponse
from database import get_supabase
from auth_utils import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter()


@router.post("/signup", response_model=Token)
async def signup(user_data: UserCreate, supabase=Depends(get_supabase)):
    # Fast lookup in Supabase
    existing = supabase.table("users").select("id").eq("email", user_data.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_doc = {
        "name":     user_data.name,
        "email":    user_data.email,
        "password": hash_password(user_data.password),
        "role":     user_data.role.value,
    }
    result = supabase.table("users").insert(user_doc).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create user")
    
    new_user = result.data[0]
    user_id = str(new_user["id"])

    token = create_access_token({
        "sub":   user_id,
        "email": new_user["email"],
        "role":  new_user["role"],
        "name":  new_user["name"],
    })
    return Token(
        access_token=token,
        token_type="bearer",
        user=UserResponse(id=user_id, name=new_user["name"],
                         email=new_user["email"], role=new_user["role"]),
    )


@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, supabase=Depends(get_supabase)):
    # Supabase indexed lookup
    result = supabase.table("users").select("*").eq("email", user_data.email).execute()
    user = result.data[0] if result.data else None

    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user["id"])
    token = create_access_token({
        "sub":   user_id,
        "email": user["email"],
        "role":  user["role"],
        "name":  user["name"],
    })
    return Token(
        access_token=token,
        token_type="bearer",
        user=UserResponse(id=user_id, name=user["name"],
                         email=user["email"], role=user["role"]),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    # Pure JWT decode — no DB hit, instant response
    return UserResponse(
        id=current_user["sub"],
        name=current_user["name"],
        email=current_user["email"],
        role=current_user["role"],
    )
