"""
Excel Attendance Processor
holiday_dates is now passed as a parameter (not hardcoded).
"""
import pandas as pd
import numpy as np
from datetime import datetime
from typing import List, Dict, Any, Optional
import re
import io

OFFICE_START_MIN = 9 * 60


def _safe_str(val) -> str:
    if val is None:
        return ""
    try:
        if pd.isna(val):
            return ""
    except (TypeError, ValueError):
        pass
    return str(val).strip()


def parse_time_str(val) -> Optional[str]:
    s = _safe_str(val)
    if not s or s in ("----", "None", "nan", "NaT", "00:00"):
        return None
    m = re.match(r'^(\d{1,2}):(\d{2})(?::\d{2})?$', s)
    if m:
        hh, mm = int(m.group(1)), int(m.group(2))
        if 0 <= hh <= 23 and 0 <= mm <= 59:
            return f"{hh:02d}:{mm:02d}"
    if hasattr(val, 'hour'):
        return f"{val.hour:02d}:{val.minute:02d}"
    try:
        t = pd.to_datetime(s)
        return f"{t.hour:02d}:{t.minute:02d}"
    except Exception:
        pass
    return None


def parse_date_str(val) -> Optional[str]:
    s = _safe_str(val)
    if not s or s in ("None", "nan", "NaT"):
        return None
    if re.match(r'^\d{4}-\d{2}-\d{2}$', s):
        return s
    if re.match(r'^\d{1,2}$', s):
        return None
    try:
        return pd.to_datetime(val).strftime("%Y-%m-%d")
    except Exception:
        return None


def normalize_status(val) -> str:
    s = _safe_str(val).upper()
    if s.startswith("P"):
        return "P"
    return "A"


def is_sunday(date_str: str) -> bool:
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").weekday() == 6
    except Exception:
        return False


def is_holiday(date_str: str, holiday_dates: List[int]) -> bool:
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").day in holiday_dates
    except Exception:
        return False


def compute_timing(in_time_str: Optional[str]):
    if not in_time_str:
        return 0, 0, None
    try:
        hh, mm = map(int, in_time_str.split(":"))
        arrival = hh * 60 + mm
        diff = arrival - OFFICE_START_MIN
        if diff < 0:
            return abs(diff), 0, "Early"
        elif diff > 0:
            return 0, diff, "Late"
        else:
            return 0, 0, "On Time"
    except Exception:
        return 0, 0, None


def _aggregate(records: List[Dict]) -> List[Dict]:
    emp_groups: Dict[str, List[Dict]] = {}
    for r in records:
        emp_groups.setdefault(r["empcode"], []).append(r)
    out = []
    for recs in emp_groups.values():
        present = sum(1 for r in recs if r["status"] == "P")
        absent  = len(recs) - present
        for r in recs:
            r["present_no_days"] = present
            r["absent_no_days"]  = absent
        out.extend(recs)
    return out


_COL_MAP = {
    "empcode": "empcode", "emp_code": "empcode", "emp.code": "empcode",
    "employee_code": "empcode", "emp_no": "empcode", "empno": "empcode",
    "name": "name", "employee_name": "name", "emp_name": "name",
    "department": "department", "dept": "department", "dept.": "department",
    "dept_name": "department", "dept._name": "department", "dept.name": "department",
    "date": "date", "day": "day",
    "in_time": "in_time", "in": "in_time", "intime": "in_time",
    "punch_in": "in_time", "check_in": "in_time",
    "out_time": "out_time", "out": "out_time", "outtime": "out_time",
    "punch_out": "out_time", "check_out": "out_time",
    "work_hour": "work_hour", "work_hours": "work_hour", "workhour": "work_hour",
    "working_hours": "work_hour", "duration": "work_hour", "hours": "work_hour",
    "work_dur": "work_hour",
    "status": "status", "sts": "status", "attendance": "status",
    "early_minutes": "early_minutes", "early_mins": "early_minutes",
    "early_minut": "early_minutes", "arly_minute": "early_minutes",
    "late_minutes": "late_minutes", "late_mins": "late_minutes",
    "te_minutes": "late_minutes", "late_minut": "late_minutes",
    "te_minute": "late_minutes",
    "minutes_diff": "minutes_diff", "minutes_di": "minutes_diff",
    "min_diff": "minutes_diff", "hinutes_di": "minutes_diff",
    "reporting_status": "reporting_status", "reporting_sta": "reporting_status",
    "report_status": "reporting_status", "orting_sta": "reporting_status",
    "orting_status": "reporting_status",
    "present_no_days": "present_no_days", "sent_no_d": "present_no_days",
    "present_days": "present_no_days", "present_no": "present_no_days",
    "absent_no_days": "absent_no_days", "sent_no_days": "absent_no_days",
    "absent_days": "absent_no_days", "absent_no": "absent_no_days",
}


def _normalise_col(raw: str) -> str:
    key = raw.strip().lower().replace(" ", "_").replace(".", "_")
    if key in _COL_MAP:
        return _COL_MAP[key]
    for k, v in _COL_MAP.items():
        if key.startswith(k[:6]) and len(key) >= 5:
            return v
        if k.startswith(key[:6]) and len(key) >= 5:
            return v
    return key


def parse_flat_excel(file_bytes: bytes, holiday_dates: List[int] = None) -> List[Dict[str, Any]]:
    if holiday_dates is None:
        holiday_dates = []
    try:
        xl = pd.ExcelFile(io.BytesIO(file_bytes))
    except Exception as e:
        raise ValueError(f"Cannot open Excel file: {e}")

    all_records: List[Dict] = []

    for sheet in xl.sheet_names:
        try:
            df = pd.read_excel(io.BytesIO(file_bytes), sheet_name=sheet)
        except Exception:
            continue
        if df.empty:
            continue
        df.columns = [_normalise_col(str(c)) for c in df.columns]
        if "empcode" not in df.columns or "date" not in df.columns:
            continue

        for _, row in df.iterrows():
            empcode = _safe_str(row.get("empcode", ""))
            if not empcode:
                continue
            date_str = parse_date_str(row.get("date"))
            if not date_str:
                continue
            if is_sunday(date_str) or is_holiday(date_str, holiday_dates):
                continue

            status   = normalize_status(row.get("status", "A"))
            in_time  = parse_time_str(row.get("in_time"))
            out_time = parse_time_str(row.get("out_time"))
            wh_raw   = _safe_str(row.get("work_hour", ""))
            work_hour = wh_raw if wh_raw and wh_raw not in ("0", "00:00", "0:00") else None

            early_min = int(row["early_minutes"]) if "early_minutes" in df.columns and not pd.isna(row.get("early_minutes")) else None
            late_min  = int(row["late_minutes"])  if "late_minutes"  in df.columns and not pd.isna(row.get("late_minutes"))  else None
            rep_stat  = _safe_str(row.get("reporting_status", "")) or None

            if early_min is None or late_min is None:
                early_min, late_min, rep_stat = compute_timing(in_time) if status == "P" else (0, 0, None)
            elif rep_stat is None:
                _, _, rep_stat = compute_timing(in_time) if status == "P" else (0, 0, None)

            try:
                day_abbr = datetime.strptime(date_str, "%Y-%m-%d").strftime("%a")
            except Exception:
                day_abbr = _safe_str(row.get("day", ""))

            all_records.append({
                "empcode":          empcode,
                "name":             _safe_str(row.get("name", "")),
                "department":       _safe_str(row.get("department", "")),
                "date":             date_str,
                "day":              day_abbr,
                "in_time":          in_time,
                "out_time":         out_time,
                "work_hour":        work_hour,
                "status":           status,
                "early_minutes":    max(0, early_min or 0),
                "late_minutes":     max(0, late_min  or 0),
                "reporting_status": rep_stat,
                "present_no_days":  0,
                "absent_no_days":   0,
            })

    return _aggregate(all_records)


def _safe_row(raw_row, length=None) -> List[str]:
    out = []
    for c in raw_row:
        try:
            out.append("" if (isinstance(c, float) and np.isnan(c)) else str(c).strip())
        except Exception:
            out.append(str(c).strip())
    return out


def _map_header(header: List[str]) -> Dict[str, int]:
    m: Dict[str, int] = {}
    for i, col in enumerate(header):
        c = col.lower().strip()
        if "date" in c:                  m.setdefault("date", i)
        elif c in ("day", "dy"):         m.setdefault("day", i)
        elif "in" in c and "time" in c:  m.setdefault("in_time", i)
        elif "out" in c and "time" in c: m.setdefault("out_time", i)
        elif "work" in c or "hour" in c: m.setdefault("work_hour", i)
        elif "status" in c or c == "sts": m.setdefault("status", i)
        elif c == "in":  m.setdefault("in_time", i)
        elif c == "out": m.setdefault("out_time", i)
    return m


def parse_block_excel(file_bytes: bytes, holiday_dates: List[int] = None) -> List[Dict[str, Any]]:
    if holiday_dates is None:
        holiday_dates = []
    try:
        xl = pd.ExcelFile(io.BytesIO(file_bytes))
    except Exception:
        return []

    all_records: List[Dict] = []
    emp_pat = re.compile(r'^[A-Z0-9]{3,}\d{2,}')

    for sheet in xl.sheet_names:
        try:
            df = pd.read_excel(io.BytesIO(file_bytes), sheet_name=sheet, header=None)
        except Exception:
            continue

        rows = df.values.tolist()
        n = len(rows)
        i = 0

        while i < n:
            row = _safe_row(rows[i])
            joined = " ".join(row).lower()
            has_empcode = any(emp_pat.match(v) for v in row)

            if ("emp" in joined or "code" in joined) and has_empcode:
                empcode = next((v for v in row if emp_pat.match(v)), "")
                idx = next((j for j, v in enumerate(row) if emp_pat.match(v)), -1)
                name = ""
                if idx >= 0:
                    for k in range(idx + 1, len(row)):
                        val = row[k].strip()
                        if val and "employee" not in val.lower() and "name" not in val.lower():
                            name = val
                            break

                department = ""
                header_idx = -1
                for j in range(i, min(i + 12, n)):
                    r = _safe_row(rows[j])
                    rj = " ".join(r).lower()
                    if "dept" in rj or "department" in rj:
                        for k, v in enumerate(r):
                            if "dept" in v.lower() or "department" in v.lower():
                                nxt = [r[x] for x in range(k + 1, len(r)) if r[x]]
                                if nxt:
                                    department = nxt[0]
                    if ("date" in rj or "day" in rj) and ("in" in rj or "status" in rj):
                        header_idx = j
                        break

                if header_idx == -1:
                    i += 1
                    continue

                hdr = _safe_row(rows[header_idx])
                col_map = _map_header(hdr)
                j = header_idx + 1
                emp_recs: List[Dict] = []

                while j < n:
                    drow = _safe_row(rows[j])
                    djoin = " ".join(drow).lower()
                    if ((("emp" in djoin or "code" in djoin) and any(emp_pat.match(v) for v in drow)) or
                        any(kw in djoin for kw in ("total", "summary", "grand total"))):
                        break

                    date_val = drow[col_map["date"]] if "date" in col_map and col_map["date"] < len(drow) else ""
                    date_str = parse_date_str(date_val)
                    if date_str and not is_sunday(date_str) and not is_holiday(date_str, holiday_dates):
                        in_raw  = drow[col_map.get("in_time",  -1)] if col_map.get("in_time",  -1) < len(drow) else ""
                        out_raw = drow[col_map.get("out_time", -1)] if col_map.get("out_time", -1) < len(drow) else ""
                        wh_raw  = drow[col_map.get("work_hour",-1)] if col_map.get("work_hour",-1) < len(drow) else ""
                        st_raw  = drow[col_map.get("status",   -1)] if col_map.get("status",   -1) < len(drow) else ""

                        in_time  = parse_time_str(in_raw)
                        out_time = parse_time_str(out_raw)
                        status   = normalize_status(st_raw)
                        wh = wh_raw if wh_raw and wh_raw not in ("----", "") else None
                        early, late, rep = compute_timing(in_time) if status == "P" else (0, 0, None)

                        try:
                            day_abbr = datetime.strptime(date_str, "%Y-%m-%d").strftime("%a")
                        except Exception:
                            day_abbr = drow[col_map["day"]] if "day" in col_map else ""

                        emp_recs.append({
                            "empcode": empcode, "name": name, "department": department,
                            "date": date_str, "day": day_abbr,
                            "in_time": in_time, "out_time": out_time,
                            "work_hour": wh, "status": status,
                            "early_minutes": early, "late_minutes": late,
                            "reporting_status": rep,
                            "present_no_days": 0, "absent_no_days": 0,
                        })
                    j += 1

                if emp_recs:
                    p = sum(1 for r in emp_recs if r["status"] == "P")
                    a = len(emp_recs) - p
                    for r in emp_recs:
                        r["present_no_days"] = p
                        r["absent_no_days"]  = a
                    all_records.extend(emp_recs)
                i = j
            else:
                i += 1

    return all_records


def process_excel_file(file_bytes: bytes, holiday_dates: List[int] = None) -> List[Dict[str, Any]]:
    """
    Try flat format first, then block format.
    
    Args:
        file_bytes: Raw Excel file bytes
        holiday_dates: Day-of-month integers to exclude (e.g. [7, 21]). Empty = no holidays.
    """
    if holiday_dates is None:
        holiday_dates = []

    try:
        records = parse_flat_excel(file_bytes, holiday_dates)
        if records:
            print(f"✅ Flat parser: {len(records)} records")
            return records
    except Exception as e:
        print(f"Flat parser error: {e}")

    try:
        records = parse_block_excel(file_bytes, holiday_dates)
        if records:
            print(f"✅ Block parser: {len(records)} records")
            return records
    except Exception as e:
        print(f"Block parser error: {e}")

    return []
