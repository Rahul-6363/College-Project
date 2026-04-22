-- ============================================================
-- AttendIQ — Supabase PostgreSQL Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL, -- 'principal' or 'data_manager'
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
    id          BIGSERIAL PRIMARY KEY,
    empcode     TEXT NOT NULL,
    name        TEXT NOT NULL,
    department  TEXT,
    date        DATE NOT NULL,
    day         TEXT,
    in_time     TEXT,
    out_time    TEXT,
    work_hour   TEXT,
    status      TEXT NOT NULL DEFAULT 'A',       -- 'P' or 'A'
    early_minutes   INTEGER DEFAULT 0,
    late_minutes    INTEGER DEFAULT 0,
    reporting_status TEXT,                        -- 'Early', 'Late', 'On Time'
    present_no_days INTEGER DEFAULT 0,
    absent_no_days  INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT attendance_empcode_date_unique UNIQUE (empcode, date)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_users_email           ON users (email);

CREATE INDEX IF NOT EXISTS idx_attendance_empcode    ON attendance (empcode);
CREATE INDEX IF NOT EXISTS idx_attendance_date       ON attendance (date);
CREATE INDEX IF NOT EXISTS idx_attendance_department ON attendance (department);
CREATE INDEX IF NOT EXISTS idx_attendance_status     ON attendance (status);
CREATE INDEX IF NOT EXISTS idx_attendance_reporting  ON attendance (reporting_status);
CREATE INDEX IF NOT EXISTS idx_attendance_dept_date  ON attendance (department, date);
CREATE INDEX IF NOT EXISTS idx_attendance_emp_created ON attendance (empcode, created_at DESC);

-- ============================================================
-- ── DATABASE FUNCTIONS ──────────────────────────────────────
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ── TRIGGERS ────────────────────────────────────────────────
-- ============================================================

DROP TRIGGER IF EXISTS trg_attendance_updated_at ON attendance;
CREATE TRIGGER trg_attendance_updated_at
BEFORE UPDATE ON attendance
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ── ROW LEVEL SECURITY (RLS) POLICIES ───────────────────────
-- ============================================================
-- These policies allow the backend (using the anon key) to 
-- perform CRUD operations. 

-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Create "Permissive" policies for development
-- Note: In a production environment, you would restrict these 
-- based on authenticated roles or use the service_role key.

DROP POLICY IF EXISTS "Allow all operations for users" ON users;
CREATE POLICY "Allow all operations for users" ON users FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all operations for attendance" ON attendance;
CREATE POLICY "Allow all operations for attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- ── OPTIMIZED ANALYTICS FUNCTIONS ───────────────────────────
-- ============================================================

-- Get unique departments without fetching all rows
CREATE OR REPLACE FUNCTION get_unique_departments()
RETURNS TABLE (department TEXT) AS $$
BEGIN
    RETURN QUERY SELECT DISTINCT a.department FROM attendance a WHERE a.department IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Get unique employees without fetching all rows
CREATE OR REPLACE FUNCTION get_unique_employees(dept_filter TEXT DEFAULT NULL)
RETURNS TABLE (empcode TEXT, name TEXT, department TEXT) AS $$
BEGIN
    RETURN QUERY SELECT DISTINCT ON (a.empcode) a.empcode, a.name, a.department 
    FROM attendance a 
    WHERE (dept_filter IS NULL OR a.department = dept_filter)
    AND a.department IS NOT NULL
    ORDER BY a.empcode, a.created_at DESC;
END;
$$ LANGUAGE plpgsql;
-- ── get_unique_months: returns distinct YYYY-MM strings ──────────────────────
CREATE OR REPLACE FUNCTION get_unique_months()
RETURNS TABLE(month TEXT) AS $$
  SELECT DISTINCT TO_CHAR(date::date, 'YYYY-MM') AS month
  FROM attendance
  ORDER BY month DESC;
$$ LANGUAGE sql STABLE;
