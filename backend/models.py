from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import date, time
from enum import Enum

class Role(str, Enum):
    PRINCIPAL = "principal"
    DATA_MANAGER = "data_manager"

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Role

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: Role

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class AttendanceRecord(BaseModel):
    empcode: str
    name: str
    department: str
    date: str
    day: str
    in_time: Optional[str] = None
    out_time: Optional[str] = None
    work_hour: Optional[str] = None
    status: str
    early_minutes: int = 0
    late_minutes: int = 0
    reporting_status: Optional[str] = None
    present_no_days: Optional[int] = None
    absent_no_days: Optional[int] = None

class UploadResponse(BaseModel):
    success: bool
    message: str
    records_processed: int
    records_inserted: int

class AnalyticsFilter(BaseModel):
    department: Optional[str] = None
    empcode: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None