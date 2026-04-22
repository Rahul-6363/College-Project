from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query, Form
from typing import Optional, List
from database import get_supabase
from auth_utils import get_current_user, require_data_manager, require_principal
from excel_processor import process_excel_file
import time
import json

router = APIRouter()

MAX_FILE_MB = 20


@router.post("/upload")
async def upload_attendance(
    file: UploadFile = File(...),
    holiday_dates: str = Form(default="[]"),   # JSON array string e.g. "[7, 21]"
    current_user: dict = Depends(require_data_manager),
    supabase=Depends(get_supabase),
):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx / .xls files are accepted")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="File is empty")
    if len(file_bytes) > MAX_FILE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File exceeds {MAX_FILE_MB} MB limit")

    # Parse holiday_dates from JSON string
    try:
        parsed_holidays: List[int] = json.loads(holiday_dates)
        if not isinstance(parsed_holidays, list):
            parsed_holidays = []
        parsed_holidays = [int(d) for d in parsed_holidays if str(d).strip().isdigit()]
    except Exception:
        parsed_holidays = []

    try:
        records = process_excel_file(file_bytes, holiday_dates=parsed_holidays)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse file: {e}")

    if not records:
        raise HTTPException(
            status_code=422,
            detail=(
                "No valid records found. Make sure your file has these columns: "
                "empcode, name, department, date, day, in_time, out_time, "
                "work_hour, status. The file can be flat (one row per day) or "
                "block-based (one block per employee)."
            ),
        )

    rows = []
    for r in records:
        if not r.get("empcode") or not r.get("date"):
            continue
        rows.append({
            "empcode":          str(r["empcode"]),
            "name":             str(r.get("name", "")),
            "department":       str(r.get("department", "")),
            "date":             r["date"],
            "day":              str(r.get("day", "")),
            "in_time":          r.get("in_time"),
            "out_time":         r.get("out_time"),
            "work_hour":        r.get("work_hour"),
            "status":           r.get("status", "A"),
            "early_minutes":    int(r.get("early_minutes") or 0),
            "late_minutes":     int(r.get("late_minutes")  or 0),
            "reporting_status": r.get("reporting_status"),
            "present_no_days":  int(r.get("present_no_days") or 0),
            "absent_no_days":   int(r.get("absent_no_days")  or 0),
        })

    if not rows:
        raise HTTPException(status_code=422, detail="All records were filtered out (Sundays/holidays only?)")

    unique_rows = {}
    for row in rows:
        key = (row["empcode"], row["date"])
        unique_rows[key] = row
    rows = list(unique_rows.values())

    BATCH = 200
    inserted = 0
    max_retries = 3

    try:
        for i in range(0, len(rows), BATCH):
            batch_data = rows[i: i + BATCH]
            for attempt in range(max_retries):
                try:
                    supabase.table("attendance").upsert(batch_data, on_conflict="empcode,date").execute()
                    inserted += len(batch_data)
                    break
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise e
                    time.sleep(1)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database write failed: {e}")

    return {
        "success":           True,
        "message":           "Attendance data processed and stored successfully",
        "records_processed": len(records),
        "records_inserted":  inserted,
        "filename":          file.filename,
        "holidays_used":     parsed_holidays,
    }


@router.get("/records")
async def get_records(
    empcode:    Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date:   Optional[str] = Query(None),
    month:      Optional[str] = Query(None),   # e.g. "2024-03" → filter by month
    status:     Optional[str] = Query(None),
    page:       int = Query(1, ge=1),
    page_size:  int = Query(50, ge=1, le=200),
    current_user: dict = Depends(require_principal),
    supabase=Depends(get_supabase),
):
    q = supabase.table("attendance").select("*")
    if empcode:    q = q.eq("empcode", empcode)
    if department: q = q.eq("department", department)
    if month:      # month filter: "2024-03" → 2024-03-01 to 2024-03-31
        import calendar
        try:
            y, m = map(int, month.split("-"))
            last_day = calendar.monthrange(y, m)[1]
            q = q.gte("date", f"{y:04d}-{m:02d}-01").lte("date", f"{y:04d}-{m:02d}-{last_day:02d}")
        except Exception:
            pass
    else:
        if start_date: q = q.gte("date", start_date)
        if end_date:   q = q.lte("date", end_date)
    if status:     q = q.eq("status", status)
    offset = (page - 1) * page_size
    result = q.order("date", desc=True).range(offset, offset + page_size - 1).execute()
    return {"records": result.data or [], "page": page, "page_size": page_size}


@router.get("/employees")
async def get_employees(
    department: Optional[str] = Query(None),
    current_user: dict = Depends(require_principal),
    supabase=Depends(get_supabase),
):
    result = supabase.rpc("get_unique_employees", {"dept_filter": department or None}).execute()
    data = result.data or []
    return {"employees": sorted(data, key=lambda x: x["name"])}


@router.get("/departments")
async def get_departments(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    result = supabase.rpc("get_unique_departments").execute()
    depts = sorted([r["department"] for r in (result.data or []) if r.get("department")])
    return {"departments": depts}


@router.get("/months")
async def get_available_months(
    current_user: dict = Depends(get_current_user),
    supabase=Depends(get_supabase),
):
    """Return distinct YYYY-MM months that exist in attendance data."""
    result = supabase.rpc("get_unique_months").execute()
    months = sorted([r["month"] for r in (result.data or []) if r.get("month")], reverse=True)
    return {"months": months}


@router.get("/employee/{empcode}/summary")
async def get_employee_summary(
    empcode:    str,
    start_date: Optional[str] = Query(None),
    end_date:   Optional[str] = Query(None),
    month:      Optional[str] = Query(None),
    current_user: dict = Depends(require_principal),
    supabase=Depends(get_supabase),
):
    q = supabase.table("attendance").select("*").eq("empcode", empcode)
    if month:
        import calendar
        try:
            y, m = map(int, month.split("-"))
            last_day = calendar.monthrange(y, m)[1]
            q = q.gte("date", f"{y:04d}-{m:02d}-01").lte("date", f"{y:04d}-{m:02d}-{last_day:02d}")
        except Exception:
            pass
    else:
        if start_date: q = q.gte("date", start_date)
        if end_date:   q = q.lte("date", end_date)
    result  = q.order("date").execute()
    records = result.data or []

    if not records:
        raise HTTPException(status_code=404, detail="No records found for this employee")

    total      = len(records)
    present    = sum(1 for r in records if r["status"] == "P")
    absent     = total - present
    late_days  = sum(1 for r in records if r.get("reporting_status") == "Late")
    early_days = sum(1 for r in records if r.get("reporting_status") == "Early")
    on_time    = sum(1 for r in records if r.get("reporting_status") == "On Time")
    avg_late   = round(sum(r.get("late_minutes",  0) or 0 for r in records) / total, 1) if total else 0
    avg_early  = round(sum(r.get("early_minutes", 0) or 0 for r in records) / total, 1) if total else 0

    return {
        "empcode":           empcode,
        "name":              records[0]["name"],
        "department":        records[0]["department"],
        "total_days":        total,
        "present":           present,
        "absent":            absent,
        "late_days":         late_days,
        "early_days":        early_days,
        "on_time_days":      on_time,
        "avg_late_minutes":  avg_late,
        "avg_early_minutes": avg_early,
        "attendance_pct":    round(present / total * 100, 1) if total else 0,
        "records":           records,
    }
