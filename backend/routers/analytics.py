"""
Analytics router — all aggregations done in Python after fetching
only the columns needed for speed. Supports month= filter (YYYY-MM).
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional
from collections import defaultdict
from database import get_supabase
from auth_utils import require_principal
import calendar

router = APIRouter()


def _q_filters(q, department, start_date, end_date, month):
    if department: q = q.eq("department", department)
    if month:
        try:
            y, m = map(int, month.split("-"))
            last_day = calendar.monthrange(y, m)[1]
            q = q.gte("date", f"{y:04d}-{m:02d}-01").lte("date", f"{y:04d}-{m:02d}-{last_day:02d}")
        except Exception:
            pass
    else:
        if start_date: q = q.gte("date", start_date)
        if end_date:   q = q.lte("date", end_date)
    return q


@router.get("/overview")
async def get_overview(
    department: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date:   Optional[str] = Query(None),
    month:      Optional[str] = Query(None),
    current_user: dict = Depends(require_principal),
    supabase=Depends(get_supabase),
):
    q = supabase.table("attendance").select("status, reporting_status, empcode")
    q = _q_filters(q, department, start_date, end_date, month)
    rows = (q.execute().data) or []

    total = len(rows)
    if total == 0:
        return {"total_records": 0, "total_employees": 0, "present": 0,
                "absent": 0, "late": 0, "early": 0, "on_time": 0, "attendance_pct": 0.0}

    present = sum(1 for r in rows if r["status"] == "P")
    return {
        "total_records":    total,
        "total_employees":  len(set(r["empcode"] for r in rows)),
        "present":          present,
        "absent":           total - present,
        "late":             sum(1 for r in rows if r.get("reporting_status") == "Late"),
        "early":            sum(1 for r in rows if r.get("reporting_status") == "Early"),
        "on_time":          sum(1 for r in rows if r.get("reporting_status") == "On Time"),
        "attendance_pct":   round(present / total * 100, 1),
    }


@router.get("/late-reporters")
async def get_late_reporters(
    department: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date:   Optional[str] = Query(None),
    month:      Optional[str] = Query(None),
    limit:      int = Query(20, ge=1, le=200),
    current_user: dict = Depends(require_principal),
    supabase=Depends(get_supabase),
):
    q = supabase.table("attendance").select(
        "empcode, name, department, late_minutes"
    ).eq("reporting_status", "Late")
    q = _q_filters(q, department, start_date, end_date, month)
    rows = (q.execute().data) or []

    agg = defaultdict(lambda: {"empcode": "", "name": "", "department": "", "late_days": 0, "total_late": 0})
    for r in rows:
        k = r["empcode"]
        agg[k]["empcode"]    = r["empcode"]
        agg[k]["name"]       = r["name"]
        agg[k]["department"] = r["department"]
        agg[k]["late_days"]  += 1
        agg[k]["total_late"] += r.get("late_minutes") or 0

    ranked = sorted(agg.values(), key=lambda x: x["late_days"], reverse=True)
    for e in ranked:
        e["avg_late_minutes"] = round(e["total_late"] / e["late_days"], 1) if e["late_days"] else 0
        del e["total_late"]

    return {"reporters": ranked[:limit], "total_employees": len(ranked)}


@router.get("/early-reporters")
async def get_early_reporters(
    department: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date:   Optional[str] = Query(None),
    month:      Optional[str] = Query(None),
    limit:      int = Query(20, ge=1, le=200),
    current_user: dict = Depends(require_principal),
    supabase=Depends(get_supabase),
):
    q = supabase.table("attendance").select(
        "empcode, name, department, early_minutes"
    ).eq("reporting_status", "Early")
    q = _q_filters(q, department, start_date, end_date, month)
    rows = (q.execute().data) or []

    agg = defaultdict(lambda: {"empcode": "", "name": "", "department": "", "early_days": 0, "total_early": 0})
    for r in rows:
        k = r["empcode"]
        agg[k]["empcode"]     = r["empcode"]
        agg[k]["name"]        = r["name"]
        agg[k]["department"]  = r["department"]
        agg[k]["early_days"]  += 1
        agg[k]["total_early"] += r.get("early_minutes") or 0

    ranked = sorted(agg.values(), key=lambda x: x["early_days"], reverse=True)
    for e in ranked:
        e["avg_early_minutes"] = round(e["total_early"] / e["early_days"], 1) if e["early_days"] else 0
        del e["total_early"]

    return {"reporters": ranked[:limit], "total_employees": len(ranked)}


@router.get("/department-summary")
async def get_department_summary(
    start_date: Optional[str] = Query(None),
    end_date:   Optional[str] = Query(None),
    month:      Optional[str] = Query(None),
    current_user: dict = Depends(require_principal),
    supabase=Depends(get_supabase),
):
    q = supabase.table("attendance").select(
        "department, status, reporting_status, late_minutes"
    )
    q = _q_filters(q, None, start_date, end_date, month)
    rows = (q.execute().data) or []

    dept = defaultdict(lambda: {
        "total": 0, "present": 0, "absent": 0,
        "late": 0, "early": 0, "on_time": 0, "total_late_min": 0
    })
    for r in rows:
        d = r.get("department") or "Unknown"
        dept[d]["total"] += 1
        if r["status"] == "P":
            dept[d]["present"] += 1
        else:
            dept[d]["absent"] += 1
        rs = r.get("reporting_status")
        if rs == "Late":
            dept[d]["late"] += 1
            dept[d]["total_late_min"] += r.get("late_minutes") or 0
        elif rs == "Early":
            dept[d]["early"] += 1
        elif rs == "On Time":
            dept[d]["on_time"] += 1

    summary = []
    for name, s in dept.items():
        summary.append({
            "department":       name,
            "total_records":    s["total"],
            "present":          s["present"],
            "absent":           s["absent"],
            "late":             s["late"],
            "early":            s["early"],
            "on_time":          s["on_time"],
            "attendance_pct":   round(s["present"] / s["total"] * 100, 1) if s["total"] else 0,
            "avg_late_minutes": round(s["total_late_min"] / s["late"], 1) if s["late"] else 0,
        })

    return {"departments": sorted(summary, key=lambda x: x["attendance_pct"], reverse=True)}
