import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import Navbar from '../components/Navbar';
import StatCard from '../components/StatCard';
import api from '../utils/api';

// ── Constants ────────────────────────────────────────────────────────────────
const TABS = ['Overview', 'Late Reporters', 'Early Reporters', 'Employee Report', 'Departments', 'Late Summary', '📧 Send Report'];

// Chart color palette for white theme
const CHART_COLORS = {
  blue:    '#2563eb',
  emerald: '#059669',
  rose:    '#dc2626',
  amber:   '#d97706',
  violet:  '#7c3aed',
  sky:     '#0284c7',
};

// Tooltip style for recharts
const TT = {
  background: '#ffffff',
  border: '1px solid #e0e4ec',
  borderRadius: 8,
  color: '#111827',
  fontSize: '0.82rem',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
};

// ── Utilities ─────────────────────────────────────────────────────────────────
function useDebounce(v, ms) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

function printDiv(id, title) {
  const el = document.getElementById(id);
  if (!el) return;
  const w = window.open('', '_blank');
  w.document.write(`
    <html><head><title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111; background: #fff; padding: 24px; }
      h2 { font-size: 1.4rem; margin-bottom: 4px; }
      p  { color: #555; font-size: 0.85rem; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
      th { background: #f0f2f5; padding: 7px 10px; text-align: left; border: 1px solid #ddd; font-weight: 700; }
      td { padding: 6px 10px; border: 1px solid #ddd; }
      tr:nth-child(even) td { background: #f9fafb; }
      .badge-p    { display:inline-block; padding:2px 7px; border-radius:4px; background:#d1fae5; color:#065f46; font-size:0.7rem; font-weight:700; }
      .badge-a    { display:inline-block; padding:2px 7px; border-radius:4px; background:#fee2e2; color:#991b1b; font-size:0.7rem; font-weight:700; }
      .badge-late { display:inline-block; padding:2px 7px; border-radius:4px; background:#fef3c7; color:#92400e; font-size:0.7rem; font-weight:700; }
      .badge-early{ display:inline-block; padding:2px 7px; border-radius:4px; background:#d1fae5; color:#065f46; font-size:0.7rem; font-weight:700; }
      .badge-ot   { display:inline-block; padding:2px 7px; border-radius:4px; background:#dbeafe; color:#1e40af; font-size:0.7rem; font-weight:700; }
      @media print { @page { margin: 16mm; } }
    </style></head><body>
    ${el.innerHTML}
    </body></html>`);
  w.document.close();
  setTimeout(() => { w.print(); }, 400);
}

// ── Micro-components ──────────────────────────────────────────────────────────
function Badge({ status }) {
  const isP = status === 'P';
  return <span className={isP ? 'badge-p' : 'badge-a'}>{isP ? 'Present' : 'Absent'}</span>;
}
function RBadge({ s }) {
  const cls = { Late: 'badge-late', Early: 'badge-early', 'On Time': 'badge-ot' }[s] || '';
  return <span className={cls || 'badge-ot'} style={!cls ? { background: '#f3f4f6', color: '#6b7280' } : {}}>{s || '—'}</span>;
}
function ScreenBadge({ status }) {
  const isP = status === 'P';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 9px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700,
      background: isP ? 'rgba(5,150,105,0.12)' : 'rgba(220,38,38,0.12)',
      color: isP ? '#059669' : '#dc2626',
    }}>{isP ? 'Present' : 'Absent'}</span>
  );
}
function ScreenRBadge({ s }) {
  const m = {
    Late:     ['rgba(220,38,38,0.10)',    '#dc2626'],
    Early:    ['rgba(5,150,105,0.10)',    '#059669'],
    'On Time':['rgba(37,99,235,0.10)',    '#2563eb'],
  };
  const [bg, c] = m[s] || ['#f3f4f6', '#6b7280'];
  return (
    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, background: bg, color: c }}>
      {s || '—'}
    </span>
  );
}
function Empty({ msg, icon = '📭' }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 24px', color: '#9ca3af' }}>
      <div style={{ fontSize: '2.2rem', marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: '0.875rem', lineHeight: 1.6, color: '#6b7280' }}>{msg}</div>
    </div>
  );
}
function ErrState({ msg, onRetry }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: '1.8rem', marginBottom: 10 }}>⚠️</div>
      <div style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: 14 }}>{msg}</div>
      {onRetry && (
        <button onClick={onRetry} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: '0.85rem' }}>
          Retry
        </button>
      )}
    </div>
  );
}
function LoadGrid({ n = 4 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 14, marginBottom: 24 }}>
      {Array.from({ length: n }).map((_, i) => <div key={i} className="skeleton" style={{ height: 100 }} />)}
    </div>
  );
}
function LoadRows({ n = 6 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: n }).map((_, i) => <div key={i} className="skeleton" style={{ height: 46 }} />)}
    </div>
  );
}
function RankTable({ data, cols, rankColor }) {
  return (
    <div style={S.tCard}>
      <div style={{ overflowX: 'auto' }}>
        <table style={S.tbl}>
          <thead>
            <tr>{[{ k: '__rank', l: '#' }, ...cols].map(c => <th key={c.k} style={S.th}>{c.l}</th>)}</tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} style={S.tr}>
                <td style={S.td}>
                  <span style={{
                    display: 'inline-flex', width: 24, height: 24, borderRadius: '50%',
                    alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700,
                    background: i < 3 ? rankColor + '18' : '#f3f4f6',
                    color: i < 3 ? rankColor : '#9ca3af',
                  }}>{i + 1}</span>
                </td>
                {cols.map(c => <td key={c.k} style={S.td}>{c.fmt ? c.fmt(row[c.k]) : (row[c.k] ?? '—')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function PdfBtn({ onClick, label = '⬇ Download PDF' }) {
  return <button onClick={onClick} style={S.pdfBtn}>{label}</button>;
}
function Fgroup({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {children}
    </div>
  );
}
function SecHdr({ title, desc, children }) {
  return (
    <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ flex: 1 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: '#111827', marginBottom: 4 }}>{title}</h3>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{desc}</p>
      </div>
      {children}
    </div>
  );
}
function ChartCard({ title, children, flex = 1 }) {
  return (
    <div style={{ ...S.chartCard, flex }}>
      <div style={S.chartTitle}>{title}</div>
      {children}
    </div>
  );
}
function Chip({ children }) {
  return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 600, background: '#f0f2f5',
      border: '1px solid #e0e4ec', borderRadius: 20, padding: '2px 10px', color: '#374151',
    }}>{children}</span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PrincipalDashboard() {
  const [tab, setTab] = useState('Overview');

  const [overview,    setOverview]    = useState(null);
  const [late,        setLate]        = useState([]);
  const [early,       setEarly]       = useState([]);
  const [depts,       setDepts]       = useState([]);
  const [deptList,    setDeptList]    = useState([]);
  const [monthList,   setMonthList]   = useState([]);
  const [employees,   setEmps]        = useState([]);
  const [empRpt,      setEmpRpt]      = useState(null);
  const [lateSummary, setLateSummary] = useState([]);

  const [ldg, setLdg] = useState({});
  const [err, setErr] = useState({});

  const [fDept,  setFDept]  = useState('');
  const [fEmp,   setFEmp]   = useState('');
  const [fMonth, setFMonth] = useState('');
  const [fStart, setFStart] = useState('');
  const [fEnd,   setFEnd]   = useState('');
  const [empQ,   setEmpQ]   = useState('');
  const debQ = useDebounce(empQ, 280);

  const [mailTo,   setMailTo]   = useState('');
  const [mailSubj, setMailSubj] = useState('Monthly Attendance Report');
  const [mailBody, setMailBody] = useState('Please find the attendance report attached.\n\nRegards,\nDBIT Employee Attendance Tracker');
  const [mailSent, setMailSent] = useState(false);

  const L = (k, v) => setLdg(p => ({ ...p, [k]: v }));
  const E = (k, v) => setErr(p => ({ ...p, [k]: v }));

  // Date params — month takes priority over start/end range
  function dateParams() {
    if (fMonth) return { month: fMonth };
    return { start_date: fStart || undefined, end_date: fEnd || undefined };
  }

  // ── Data fetchers ────────────────────────────────────────────────────────
  async function doOverview() {
    L('ov', true); E('ov', null);
    try {
      const r = await api.get('/api/analytics/overview', { params: { department: fDept || undefined, ...dateParams() } });
      setOverview(r.data);
    } catch (e) { E('ov', e.response?.data?.detail || 'Failed to load overview'); }
    finally { L('ov', false); }
  }
  async function doLate() {
    L('lt', true); E('lt', null);
    try {
      const r = await api.get('/api/analytics/late-reporters', { params: { department: fDept || undefined, ...dateParams(), limit: 50 } });
      setLate(r.data.reporters || []);
    } catch (e) { E('lt', e.response?.data?.detail || 'Failed'); }
    finally { L('lt', false); }
  }
  async function doEarly() {
    L('er', true); E('er', null);
    try {
      const r = await api.get('/api/analytics/early-reporters', { params: { department: fDept || undefined, ...dateParams(), limit: 50 } });
      setEarly(r.data.reporters || []);
    } catch (e) { E('er', e.response?.data?.detail || 'Failed'); }
    finally { L('er', false); }
  }
  async function doDepts() {
    L('dp', true); E('dp', null);
    try {
      const r = await api.get('/api/analytics/department-summary', { params: { ...dateParams() } });
      setDepts(r.data.departments || []);
    } catch (e) { E('dp', e.response?.data?.detail || 'Failed'); }
    finally { L('dp', false); }
  }
  async function doEmpRpt(empcode) {
    if (!empcode) return;
    L('em', true); E('em', null); setEmpRpt(null);
    try {
      const r = await api.get(`/api/attendance/employee/${empcode}/summary`, { params: { ...dateParams() } });
      setEmpRpt(r.data);
    } catch (e) {
      E('em', e.response?.status === 404
        ? 'No records for this employee in the selected date range.'
        : (e.response?.data?.detail || 'Failed'));
    } finally { L('em', false); }
  }
  async function doLateSummary() {
    L('ls', true); E('ls', null);
    try {
      const r = await api.get('/api/analytics/late-reporters', { params: { department: fDept || undefined, ...dateParams(), limit: 200 } });
      setLateSummary(r.data.reporters || []);
    } catch (e) { E('ls', e.response?.data?.detail || 'Failed'); }
    finally { L('ls', false); }
  }

  // ── Bootstrap ────────────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/api/attendance/departments').then(r => setDeptList(r.data.departments || [])).catch(() => {});
    api.get('/api/attendance/employees').then(r => setEmps(r.data.employees || [])).catch(() => {});
    // Months arrive from backend as YYYY-MM sorted descending (most recent first)
    api.get('/api/attendance/months').then(r => {
      const raw = r.data.months || [];
      // Re-sort by parsed year+month to guarantee correct chronological desc order
      const sorted = [...raw].sort((a, b) => {
        const [ay, am] = a.split('-').map(Number);
        const [by, bm] = b.split('-').map(Number);
        if (by !== ay) return by - ay;
        return bm - am;
      });
      setMonthList(sorted);
    }).catch(() => {});
  }, []);

  useEffect(() => { doOverview(); }, [fDept, fMonth, fStart, fEnd]);                                          // eslint-disable-line
  useEffect(() => { if (tab === 'Late Reporters')  doLate();  }, [tab, fDept, fMonth, fStart, fEnd]);         // eslint-disable-line
  useEffect(() => { if (tab === 'Early Reporters') doEarly(); }, [tab, fDept, fMonth, fStart, fEnd]);         // eslint-disable-line
  useEffect(() => { if (tab === 'Departments')     doDepts(); }, [tab, fMonth, fStart, fEnd]);                // eslint-disable-line
  useEffect(() => { if (tab === 'Employee Report' && fEmp) doEmpRpt(fEmp); }, [tab, fEmp, fMonth, fStart, fEnd]); // eslint-disable-line
  useEffect(() => { if (tab === 'Late Summary')    doLateSummary(); }, [tab, fDept, fMonth, fStart, fEnd]);   // eslint-disable-line

  function clearFilters() {
    setFDept(''); setFEmp(''); setFMonth(''); setFStart(''); setFEnd(''); setEmpQ(''); setEmpRpt(null);
  }

  function refreshCurrentTab() {
    if (tab === 'Overview')       doOverview();
    if (tab === 'Late Reporters') doLate();
    if (tab === 'Early Reporters')doEarly();
    if (tab === 'Departments')    doDepts();
    if (tab === 'Employee Report' && fEmp) doEmpRpt(fEmp);
    if (tab === 'Late Summary')   doLateSummary();
  }

  const filtEmps = employees.filter(e => {
    const matchQ = !debQ || e.name.toLowerCase().includes(debQ.toLowerCase()) || e.empcode.toLowerCase().includes(debQ.toLowerCase());
    const matchD = !fDept || e.department === fDept;
    return matchQ && matchD;
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <Navbar title="DBIT Employee Attendance Tracker" subtitle="Principal Dashboard" />
      <main style={S.main}>

        {/* ── Filters ── */}
        <div style={S.fbar}>
          <Fgroup label="Department">
            <select value={fDept} onChange={e => setFDept(e.target.value)} style={S.sel}>
              <option value="">All Departments</option>
              {deptList.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Fgroup>
          <Fgroup label="Month">
            <select value={fMonth} onChange={e => { setFMonth(e.target.value); if (e.target.value) { setFStart(''); setFEnd(''); } }} style={S.sel}>
              <option value="">All Months</option>
              {monthList.map(m => {
                // Format YYYY-MM as "Month YYYY" for display
                const [y, mo] = m.split('-').map(Number);
                const label = new Date(y, mo - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
                return <option key={m} value={m}>{label}</option>;
              })}
            </select>
          </Fgroup>
          <Fgroup label="From">
            <input type="date" value={fStart} onChange={e => { setFStart(e.target.value); setFMonth(''); }} style={S.inp} disabled={!!fMonth} />
          </Fgroup>
          <Fgroup label="To">
            <input type="date" value={fEnd} onChange={e => { setFEnd(e.target.value); setFMonth(''); }} style={S.inp} disabled={!!fMonth} />
          </Fgroup>
          <button onClick={clearFilters} style={S.clearBtn}>✕ Clear</button>
          <button onClick={refreshCurrentTab} style={S.rfBtn}>↻ Refresh</button>
        </div>

        {/* ── Tabs ── */}
        <div style={S.tabBar}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ ...S.tab, ...(tab === t ? S.tabOn : {}) }}>
              {t}
            </button>
          ))}
        </div>

        {/* ════════ OVERVIEW ════════ */}
        {tab === 'Overview' && (
          <div className="animate-in">
            {ldg.ov ? <LoadGrid n={6} /> : err.ov ? <ErrState msg={err.ov} onRetry={doOverview} /> : overview ? (
              <>
                <div style={S.statGrid}>
                  <StatCard label="Total Employees" value={overview.total_employees}                 icon="👤" color="#2563eb"  sub="Unique in dataset" />
                  <StatCard label="Total Records"   value={overview.total_records?.toLocaleString()} icon="📋" color="#d97706" />
                  <StatCard label="Attendance Rate" value={`${overview.attendance_pct}%`}            icon="✅" color="#059669"  sub={`${overview.present} present days`} />
                  <StatCard label="Absent Days"     value={overview.absent}                          icon="❌" color="#dc2626" />
                  <StatCard label="Late Arrivals"   value={overview.late}                            icon="⏰" color="#b45309"  sub="After 09:00 AM" />
                  <StatCard label="Early Arrivals"  value={overview.early}                           icon="🌅" color="#0284c7"  sub="Before 09:00 AM" />
                </div>
                <div style={S.chartRow}>
                  <ChartCard title="Attendance Breakdown">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Present', value: overview.present || 0 },
                            { name: 'Absent',  value: overview.absent  || 0 },
                          ]}
                          cx="50%" cy="50%" outerRadius={82} innerRadius={46}
                          dataKey="value"
                          label={({ name, percent }) => percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : ''}
                          labelLine={false}
                        >
                          <Cell fill={CHART_COLORS.emerald} />
                          <Cell fill={CHART_COLORS.rose} />
                        </Pie>
                        <Tooltip contentStyle={TT} />
                        <Legend wrapperStyle={{ fontSize: '0.8rem', color: '#6b7280' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  <ChartCard title="Reporting Status">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'On Time', value: overview.on_time || 0 },
                            { name: 'Late',    value: overview.late    || 0 },
                            { name: 'Early',   value: overview.early   || 0 },
                          ]}
                          cx="50%" cy="50%" outerRadius={82} innerRadius={46}
                          dataKey="value"
                          label={({ name, percent }) => percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : ''}
                          labelLine={false}
                        >
                          <Cell fill={CHART_COLORS.blue} />
                          <Cell fill={CHART_COLORS.rose} />
                          <Cell fill={CHART_COLORS.emerald} />
                        </Pie>
                        <Tooltip contentStyle={TT} />
                        <Legend wrapperStyle={{ fontSize: '0.8rem', color: '#6b7280' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              </>
            ) : <Empty msg="No attendance data yet. Upload a file via the Data Manager portal." />}
          </div>
        )}

        {/* ════════ LATE REPORTERS ════════ */}
        {tab === 'Late Reporters' && (
          <div className="animate-in">
            <SecHdr title="Late Reporters" desc="Employees arriving after 09:00 AM, ranked by frequency">
              {late.length > 0 && <PdfBtn onClick={() => printDiv('late-print', 'Late Reporters Report')} />}
            </SecHdr>
            {ldg.lt ? <LoadRows /> : err.lt ? <ErrState msg={err.lt} onRetry={doLate} /> : late.length > 0 ? (
              <>
                <div style={S.chartRow}>
                  <ChartCard title="Days Late — Top 10" flex={2}>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={late.slice(0, 10)} margin={{ top: 8, right: 16, bottom: 50, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e4ec" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={TT} />
                        <Bar dataKey="late_days" fill={CHART_COLORS.rose} radius={[4, 4, 0, 0]} name="Late Days" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  <ChartCard title="Avg Minutes Late">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={late.slice(0, 8)} margin={{ top: 8, right: 8, bottom: 50, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e4ec" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                        <Tooltip contentStyle={TT} />
                        <Bar dataKey="avg_late_minutes" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} name="Avg Min Late" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
                <div id="late-print" style={{ display: 'none' }}>
                  <h2>Late Reporters Report</h2>
                  <p>Filter: {fMonth || (fStart && fEnd ? `${fStart} to ${fEnd}` : 'All time')} | Dept: {fDept || 'All'}</p>
                  <table><thead><tr><th>#</th><th>Name</th><th>Code</th><th>Department</th><th>Late Days</th><th>Avg Late (min)</th></tr></thead>
                  <tbody>{late.map((r, i) => <tr key={i}><td>{i + 1}</td><td>{r.name}</td><td>{r.empcode}</td><td>{r.department}</td><td>{r.late_days}</td><td>{r.avg_late_minutes}</td></tr>)}</tbody></table>
                </div>
                <RankTable data={late} rankColor={CHART_COLORS.rose} cols={[
                  { k: 'name',             l: 'Employee' },
                  { k: 'empcode',          l: 'Code' },
                  { k: 'department',       l: 'Department' },
                  { k: 'late_days',        l: 'Late Days',      fmt: v => <strong style={{ color: '#dc2626' }}>{v}</strong> },
                  { k: 'avg_late_minutes', l: 'Avg Late (min)', fmt: v => <span style={{ color: '#d97706' }}>{v}</span> },
                ]} />
              </>
            ) : <Empty msg="No late reporters found for these filters." />}
          </div>
        )}

        {/* ════════ EARLY REPORTERS ════════ */}
        {tab === 'Early Reporters' && (
          <div className="animate-in">
            <SecHdr title="Early Reporters" desc="Employees arriving before 09:00 AM, ranked by frequency">
              {early.length > 0 && <PdfBtn onClick={() => printDiv('early-print', 'Early Reporters Report')} />}
            </SecHdr>
            {ldg.er ? <LoadRows /> : err.er ? <ErrState msg={err.er} onRetry={doEarly} /> : early.length > 0 ? (
              <>
                <div style={S.chartRow}>
                  <ChartCard title="Days Early — Top 10" flex={2}>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={early.slice(0, 10)} margin={{ top: 8, right: 16, bottom: 50, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e4ec" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={TT} />
                        <Bar dataKey="early_days" fill={CHART_COLORS.emerald} radius={[4, 4, 0, 0]} name="Early Days" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  <ChartCard title="Avg Minutes Early">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={early.slice(0, 8)} margin={{ top: 8, right: 8, bottom: 50, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e4ec" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                        <Tooltip contentStyle={TT} />
                        <Bar dataKey="avg_early_minutes" fill={CHART_COLORS.sky} radius={[4, 4, 0, 0]} name="Avg Min Early" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
                <div id="early-print" style={{ display: 'none' }}>
                  <h2>Early Reporters Report</h2>
                  <p>Filter: {fMonth || (fStart && fEnd ? `${fStart} to ${fEnd}` : 'All time')} | Dept: {fDept || 'All'}</p>
                  <table><thead><tr><th>#</th><th>Name</th><th>Code</th><th>Department</th><th>Early Days</th><th>Avg Early (min)</th></tr></thead>
                  <tbody>{early.map((r, i) => <tr key={i}><td>{i + 1}</td><td>{r.name}</td><td>{r.empcode}</td><td>{r.department}</td><td>{r.early_days}</td><td>{r.avg_early_minutes}</td></tr>)}</tbody></table>
                </div>
                <RankTable data={early} rankColor={CHART_COLORS.emerald} cols={[
                  { k: 'name',              l: 'Employee' },
                  { k: 'empcode',           l: 'Code' },
                  { k: 'department',        l: 'Department' },
                  { k: 'early_days',        l: 'Early Days',       fmt: v => <strong style={{ color: '#059669' }}>{v}</strong> },
                  { k: 'avg_early_minutes', l: 'Avg Early (min)',  fmt: v => <span style={{ color: '#0284c7' }}>{v}</span> },
                ]} />
              </>
            ) : <Empty msg="No early reporters found for these filters." />}
          </div>
        )}

        {/* ════════ EMPLOYEE REPORT ════════ */}
        {tab === 'Employee Report' && (
          <div className="animate-in">
            <div style={S.empSel}>
              <div style={{ position: 'relative' }}>
                <input
                  placeholder="Search name or code…"
                  value={empQ}
                  onChange={e => setEmpQ(e.target.value)}
                  style={{ ...S.inp, paddingLeft: 12, minWidth: 190 }}
                />
              </div>
              <select
                value={fEmp}
                onChange={e => { setFEmp(e.target.value); setEmpRpt(null); E('em', null); }}
                style={{ ...S.sel, minWidth: 280 }}
              >
                <option value="">— Select employee —</option>
                {filtEmps.map(e => <option key={e.empcode} value={e.empcode}>{e.name} ({e.empcode}) — {e.department}</option>)}
              </select>
              {empRpt && <PdfBtn onClick={() => printDiv('emp-print', `Report – ${empRpt.name}`)} />}
            </div>

            {!fEmp
              ? <Empty msg="Select an employee above to view their full report." icon="👤" />
              : ldg.em ? <LoadGrid n={6} />
              : err.em ? <ErrState msg={err.em} onRetry={() => doEmpRpt(fEmp)} />
              : empRpt ? (
                <>
                  <div id="emp-print" style={{ display: 'none' }}>
                    <h2>{empRpt.name} — Attendance Report</h2>
                    <p>{empRpt.empcode} | {empRpt.department} | Filter: {fMonth || (fStart && fEnd ? `${fStart} to ${fEnd}` : 'All time')}</p>
                    <table style={{ marginBottom: 16 }}>
                      <thead><tr><th>Metric</th><th>Value</th></tr></thead>
                      <tbody>
                        <tr><td>Total Days</td><td>{empRpt.total_days}</td></tr>
                        <tr><td>Present</td><td>{empRpt.present}</td></tr>
                        <tr><td>Absent</td><td>{empRpt.absent}</td></tr>
                        <tr><td>Attendance %</td><td>{empRpt.attendance_pct}%</td></tr>
                        <tr><td>Late Days</td><td>{empRpt.late_days}</td></tr>
                        <tr><td>Avg Late (min)</td><td>{empRpt.avg_late_minutes}</td></tr>
                        <tr><td>Early Days</td><td>{empRpt.early_days}</td></tr>
                        <tr><td>On Time Days</td><td>{empRpt.on_time_days}</td></tr>
                      </tbody>
                    </table>
                    <h3 style={{ marginBottom: 8 }}>Daily Records</h3>
                    <table><thead><tr>
                      <th>Date</th><th>Day</th><th>In</th><th>Out</th><th>Work Hrs</th>
                      <th>Status</th><th>Reporting</th><th>Late (min)</th><th>Early (min)</th>
                    </tr></thead>
                    <tbody>{(empRpt.records || []).map((r, i) => <tr key={i}>
                      <td>{r.date}</td><td>{r.day}</td><td>{r.in_time || '—'}</td><td>{r.out_time || '—'}</td>
                      <td>{r.work_hour || '—'}</td>
                      <td><Badge status={r.status} /></td>
                      <td><RBadge s={r.reporting_status} /></td>
                      <td>{r.late_minutes > 0 ? r.late_minutes : '—'}</td>
                      <td>{r.early_minutes > 0 ? r.early_minutes : '—'}</td>
                    </tr>)}</tbody></table>
                  </div>

                  {/* Screen header */}
                  <div style={S.empHdr}>
                    <div style={S.empAv}>{empRpt.name?.[0]?.toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: '#111827', marginBottom: 6 }}>{empRpt.name}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Chip>{empRpt.empcode}</Chip><Chip>{empRpt.department}</Chip>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-display)',
                        color: empRpt.attendance_pct >= 80 ? '#059669' : empRpt.attendance_pct >= 60 ? '#d97706' : '#dc2626',
                      }}>
                        {empRpt.attendance_pct}%
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attendance</div>
                    </div>
                  </div>

                  <div style={S.statGrid}>
                    <StatCard label="Present"    value={empRpt.present}      color="#059669"  icon="✅" sub={`of ${empRpt.total_days} days`} />
                    <StatCard label="Absent"     value={empRpt.absent}       color="#dc2626"  icon="❌" />
                    <StatCard label="Late Days"  value={empRpt.late_days}    color="#d97706"  icon="⏰" sub={`Avg ${empRpt.avg_late_minutes} min`} />
                    <StatCard label="Early Days" value={empRpt.early_days}   color="#0284c7"  icon="🌅" sub={`Avg ${empRpt.avg_early_minutes} min`} />
                    <StatCard label="On Time"    value={empRpt.on_time_days} color="#2563eb"  icon="🎯" />
                    <StatCard label="Total Days" value={empRpt.total_days}   color="#6b7280"  icon="📅" />
                  </div>

                  {(empRpt.records?.length || 0) > 1 && (
                    <div style={{ ...S.chartCard, marginBottom: 18 }}>
                      <div style={S.chartTitle}>Late / Early Minutes — last 30 records</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart
                          data={empRpt.records.slice(-30).map(r => ({
                            date: r.date?.slice(5) || '', late: r.late_minutes || 0, early: r.early_minutes || 0,
                          }))}
                          margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e0e4ec" vertical={false} />
                          <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} />
                          <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
                          <Tooltip contentStyle={TT} />
                          <Area type="monotone" dataKey="late"  stroke={CHART_COLORS.rose}    fill="rgba(220,38,38,0.08)"   name="Late min" />
                          <Area type="monotone" dataKey="early" stroke={CHART_COLORS.emerald} fill="rgba(5,150,105,0.08)"   name="Early min" />
                          <Legend wrapperStyle={{ fontSize: '0.78rem', color: '#6b7280' }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div style={S.tCard}>
                    <div style={{ ...S.chartTitle, padding: '12px 16px', borderBottom: '1px solid #e0e4ec', marginBottom: 0 }}>
                      Attendance History — {empRpt.records?.length} records
                    </div>
                    <div style={{ overflowX: 'auto', maxHeight: 460, overflowY: 'auto' }}>
                      <table style={S.tbl}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                          <tr>{['Date', 'Day', 'In', 'Out', 'Work Hrs', 'Status', 'Reporting', 'Late (min)', 'Early (min)'].map(h => (
                            <th key={h} style={S.th}>{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {(empRpt.records || []).map((r, i) => (
                            <tr key={i} style={{ ...S.tr, background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                              <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{r.date}</td>
                              <td style={S.td}>{r.day}</td>
                              <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{r.in_time || '—'}</td>
                              <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{r.out_time || '—'}</td>
                              <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{r.work_hour || '—'}</td>
                              <td style={S.td}><ScreenBadge status={r.status} /></td>
                              <td style={S.td}><ScreenRBadge s={r.reporting_status} /></td>
                              <td style={{ ...S.td, color: r.late_minutes > 0 ? '#dc2626' : '#9ca3af' }}>
                                {r.late_minutes > 0 ? r.late_minutes : '—'}
                              </td>
                              <td style={{ ...S.td, color: r.early_minutes > 0 ? '#059669' : '#9ca3af' }}>
                                {r.early_minutes > 0 ? r.early_minutes : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
          </div>
        )}

        {/* ════════ DEPARTMENTS ════════ */}
        {tab === 'Departments' && (
          <div className="animate-in">
            <SecHdr title="Department Analytics" desc="Attendance performance breakdown by department">
              {depts.length > 0 && <PdfBtn onClick={() => printDiv('dept-print', 'Department Report')} />}
            </SecHdr>
            {ldg.dp ? <LoadRows /> : err.dp ? <ErrState msg={err.dp} onRetry={doDepts} /> : depts.length > 0 ? (
              <>
                <div id="dept-print" style={{ display: 'none' }}>
                  <h2>Department Attendance Report</h2>
                  <p>Filter: {fMonth || (fStart && fEnd ? `${fStart} to ${fEnd}` : 'All time')}</p>
                  <table><thead><tr>
                    <th>Department</th><th>Records</th><th>Present</th><th>Absent</th>
                    <th>Rate %</th><th>Late</th><th>Early</th><th>On Time</th><th>Avg Late (min)</th>
                  </tr></thead>
                  <tbody>{depts.map((d, i) => <tr key={i}>
                    <td>{d.department}</td><td>{d.total_records}</td><td>{d.present}</td><td>{d.absent}</td>
                    <td>{d.attendance_pct}%</td><td>{d.late}</td><td>{d.early}</td><td>{d.on_time}</td><td>{d.avg_late_minutes}</td>
                  </tr>)}</tbody></table>
                </div>
                <div style={S.chartRow}>
                  <ChartCard title="Attendance Rate (%)" flex={2}>
                    <ResponsiveContainer width="100%" height={270}>
                      <BarChart data={depts} margin={{ top: 8, right: 16, bottom: 60, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e4ec" vertical={false} />
                        <XAxis dataKey="department" tick={{ fill: '#6b7280', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 11 }} unit="%" />
                        <Tooltip contentStyle={TT} formatter={v => [`${v}%`, 'Attendance']} />
                        <Bar dataKey="attendance_pct" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} name="Attendance %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                  <ChartCard title="Late vs Early by Department">
                    <ResponsiveContainer width="100%" height={270}>
                      <BarChart data={depts} margin={{ top: 8, right: 8, bottom: 60, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e4ec" vertical={false} />
                        <XAxis dataKey="department" tick={{ fill: '#6b7280', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={TT} />
                        <Bar dataKey="late"  fill={CHART_COLORS.rose}    radius={[4, 4, 0, 0]} name="Late" />
                        <Bar dataKey="early" fill={CHART_COLORS.emerald} radius={[4, 4, 0, 0]} name="Early" />
                        <Legend wrapperStyle={{ fontSize: '0.78rem', color: '#6b7280' }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
                <div style={S.tCard}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={S.tbl}>
                      <thead><tr>
                        {['Department', 'Records', 'Present', 'Absent', 'Rate %', 'Late', 'Early', 'On Time', 'Avg Late (min)'].map(h => (
                          <th key={h} style={S.th}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {depts.map((d, i) => {
                          const pc = d.attendance_pct >= 80 ? '#059669' : d.attendance_pct >= 60 ? '#d97706' : '#dc2626';
                          return (
                            <tr key={i} style={{ ...S.tr, background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                              <td style={{ ...S.td, fontWeight: 600 }}>{d.department}</td>
                              <td style={S.td}>{d.total_records}</td>
                              <td style={{ ...S.td, color: '#059669' }}>{d.present}</td>
                              <td style={{ ...S.td, color: '#dc2626' }}>{d.absent}</td>
                              <td style={{ ...S.td, fontWeight: 700, color: pc }}>{d.attendance_pct}%</td>
                              <td style={{ ...S.td, color: '#dc2626' }}>{d.late}</td>
                              <td style={{ ...S.td, color: '#059669' }}>{d.early}</td>
                              <td style={{ ...S.td, color: '#2563eb' }}>{d.on_time}</td>
                              <td style={S.td}>{d.avg_late_minutes}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : <Empty msg="No department data. Upload attendance data first." />}
          </div>
        )}

        {/* ════════ LATE SUMMARY ════════ */}
        {tab === 'Late Summary' && (
          <div className="animate-in">
            <SecHdr title="Late Minutes Summary" desc="Employee name and total late minutes — simple overview">
              {lateSummary.length > 0 && <PdfBtn onClick={() => printDiv('late-summary-print', 'Late Minutes Summary')} />}
            </SecHdr>
            {ldg.ls ? <LoadRows /> : err.ls ? <ErrState msg={err.ls} onRetry={doLateSummary} /> : lateSummary.length > 0 ? (
              <>
                <div id="late-summary-print" style={{ display: 'none' }}>
                  <h2>Late Minutes Summary</h2>
                  <p>Filter: {fMonth || (fStart && fEnd ? `${fStart} to ${fEnd}` : 'All time')} | Dept: {fDept || 'All'}</p>
                  <table><thead><tr><th>#</th><th>Employee Name</th><th>Total Late Minutes</th></tr></thead>
                  <tbody>
                    {lateSummary
                      .map(r => ({ name: r.name, total: Math.round(r.late_days * r.avg_late_minutes) }))
                      .sort((a, b) => b.total - a.total)
                      .map((r, i) => <tr key={i}><td>{i + 1}</td><td>{r.name}</td><td>{r.total}</td></tr>)}
                  </tbody></table>
                </div>
                <div style={S.tCard}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={S.tbl}>
                      <thead>
                        <tr>
                          <th style={S.th}>#</th>
                          <th style={S.th}>Employee Name</th>
                          <th style={S.th}>Total Late Minutes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lateSummary
                          .map(r => ({ name: r.name, total: Math.round(r.late_days * r.avg_late_minutes) }))
                          .sort((a, b) => b.total - a.total)
                          .map((r, i) => (
                            <tr key={i} style={{ ...S.tr, background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                              <td style={S.td}>
                                <span style={{
                                  display: 'inline-flex', width: 24, height: 24, borderRadius: '50%',
                                  alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700,
                                  background: i < 3 ? 'rgba(220,38,38,0.12)' : '#f3f4f6',
                                  color: i < 3 ? '#dc2626' : '#9ca3af',
                                }}>{i + 1}</span>
                              </td>
                              <td style={{ ...S.td, fontWeight: 600 }}>{r.name}</td>
                              <td style={{ ...S.td, color: '#dc2626', fontWeight: 700, fontSize: '1rem' }}>{r.total}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : <Empty msg="No late data for selected filters." icon="⏰" />}
          </div>
        )}

        {/* ════════ SEND REPORT ════════ */}
        {tab === '📧 Send Report' && (
          <div className="animate-in">
            <SecHdr title="Send Report via Email" desc="Email attendance reports to staff or management" />
            <div style={S.mailCard}>
              <div style={S.mailNotice}>
                <span style={{ fontSize: '1.2rem' }}>🔧</span>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: '#92400e' }}>Nodemailer integration — Placeholder</div>
                  <div style={{ fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.6 }}>
                    This form is a UI placeholder. Configure Nodemailer in your backend with SMTP credentials
                    and wire up <code style={S.code}>POST /api/mail/send</code> to activate email sending.
                  </div>
                </div>
              </div>

              {mailSent ? (
                <div style={S.mailSuccess}>
                  <span style={{ fontSize: '1.5rem' }}>✅</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#059669' }}>Email sent! (Placeholder)</div>
                    <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 4 }}>In production this would deliver to: {mailTo}</div>
                  </div>
                  <button onClick={() => { setMailSent(false); setMailTo(''); }} style={{ ...S.clearBtn, marginLeft: 'auto' }}>Send Another</button>
                </div>
              ) : (
                <div style={S.mailForm}>
                  <div style={S.mailField}>
                    <label style={S.label}>To (email address)</label>
                    <input value={mailTo} onChange={e => setMailTo(e.target.value)} type="email"
                      placeholder="principal@dbit.edu.in" style={S.inp} />
                  </div>
                  <div style={S.mailField}>
                    <label style={S.label}>Subject</label>
                    <input value={mailSubj} onChange={e => setMailSubj(e.target.value)}
                      placeholder="Monthly Attendance Report" style={S.inp} />
                  </div>
                  <div style={S.mailField}>
                    <label style={S.label}>Body</label>
                    <textarea value={mailBody} onChange={e => setMailBody(e.target.value)}
                      rows={5} style={{ ...S.inp, resize: 'vertical', width: '100%' }} />
                  </div>
                  <div style={S.mailField}>
                    <label style={S.label}>Attach Report</label>
                    <div style={S.mailAttachRow}>
                      {['Late Reporters', 'Employee Report', 'Department Summary', 'Late Summary'].map(name => (
                        <label key={name} style={S.mailCheck}>
                          <input type="checkbox" defaultChecked={name === 'Late Reporters'} style={{ accentColor: '#2563eb' }} />
                          <span style={{ fontSize: '0.83rem', color: '#374151' }}>{name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
                    <button
                      disabled={!mailTo}
                      onClick={() => { if (mailTo) setMailSent(true); }}
                      style={{ ...S.uploadBtn, opacity: mailTo ? 1 : 0.5, cursor: mailTo ? 'pointer' : 'not-allowed' }}
                    >
                      📤 Send Report (Placeholder)
                    </button>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>No real email will be sent until Nodemailer is configured</span>
                  </div>
                </div>
              )}

              <div style={S.mailInstructions}>
                <div style={{ fontWeight: 700, marginBottom: 10, fontSize: '0.78rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  How to Enable
                </div>
                {[
                  ['1', 'Install Nodemailer', "npm install nodemailer in your backend/Node service, or use Python's smtplib / yagmail"],
                  ['2', 'Add SMTP creds to .env', 'SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (or use a service key for SendGrid/Mailgun)'],
                  ['3', 'Create POST /api/mail/send', 'Accepts { to, subject, body, attachments[] } — generate PDF attachment from attendance data'],
                  ['4', 'Wire up this form', "Replace the onClick placeholder with an api.post('/api/mail/send', payload) call"],
                ].map(([n, t, d]) => (
                  <div key={n} style={S.step}>
                    <span style={S.stepN}>{n}</span>
                    <div>
                      <div style={S.stepT}>{t}</div>
                      <div style={S.stepD}>{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: { minHeight: '100vh', background: '#f5f7fa' },
  main: { padding: '22px 28px', maxWidth: 1340, margin: '0 auto' },

  fbar: {
    display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap',
    background: '#ffffff', border: '1px solid #e0e4ec',
    borderRadius: 10, padding: '14px 18px', marginBottom: 18,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  sel: {
    background: '#f9fafb', border: '1px solid #e0e4ec', borderRadius: 8,
    padding: '8px 10px', color: '#111827', fontSize: '0.85rem', minWidth: 140, outline: 'none',
  },
  inp: {
    background: '#f9fafb', border: '1px solid #e0e4ec', borderRadius: 8,
    padding: '8px 10px', color: '#111827', fontSize: '0.85rem', outline: 'none',
  },
  clearBtn: {
    background: 'transparent', border: '1px solid #e0e4ec', borderRadius: 8,
    padding: '8px 14px', color: '#6b7280', fontSize: '0.78rem', cursor: 'pointer', alignSelf: 'flex-end',
  },
  rfBtn: {
    background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 8,
    padding: '8px 14px', color: '#2563eb', fontSize: '0.78rem', cursor: 'pointer', alignSelf: 'flex-end', fontWeight: 600,
  },
  pdfBtn: {
    background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.25)', borderRadius: 8,
    padding: '8px 16px', color: '#059669', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
  },

  tabBar: {
    display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 22,
    background: '#ffffff', border: '1px solid #e0e4ec', borderRadius: 10,
    padding: 5, width: 'fit-content', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  tab: {
    background: 'transparent', border: 'none', borderRadius: 7, padding: '7px 15px',
    fontSize: '0.82rem', fontWeight: 500, color: '#6b7280', cursor: 'pointer',
    transition: 'all .18s', whiteSpace: 'nowrap',
  },
  tabOn: { background: '#2563eb', color: '#ffffff', fontWeight: 700 },

  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(185px,1fr))', gap: 13, marginBottom: 22 },
  chartRow: { display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' },
  chartCard: {
    flex: 1, minWidth: 260, background: '#ffffff', border: '1px solid #e0e4ec',
    borderRadius: 10, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  chartTitle: {
    fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
    letterSpacing: '0.05em', marginBottom: 14,
  },

  tCard: {
    background: '#ffffff', border: '1px solid #e0e4ec', borderRadius: 10,
    overflow: 'hidden', marginBottom: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  tbl:  { width: '100%', borderCollapse: 'collapse' },
  th:   {
    padding: '9px 14px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700,
    color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid #e0e4ec', background: '#f9fafb', whiteSpace: 'nowrap',
  },
  tr:   { borderBottom: '1px solid #f0f2f5' },
  td:   { padding: '9px 14px', fontSize: '0.83rem', color: '#111827' },

  empSel: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18,
    background: '#ffffff', border: '1px solid #e0e4ec', borderRadius: 10,
    padding: '13px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  empHdr: {
    display: 'flex', alignItems: 'center', gap: 16, background: '#ffffff',
    border: '1px solid #e0e4ec', borderRadius: 10, padding: '16px 20px', marginBottom: 18,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  empAv: {
    width: 50, height: 50, borderRadius: '50%',
    background: 'linear-gradient(135deg,#2563eb,#3b82f6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.4rem', fontWeight: 700, color: '#fff', flexShrink: 0,
  },

  label: { fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' },
  uploadBtn: {
    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 22px', fontSize: '0.92rem', fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 8, transition: 'opacity .18s',
  },
  step:  { display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  stepN: {
    fontSize: '0.6rem', fontWeight: 800, color: '#2563eb', background: 'rgba(37,99,235,0.08)',
    borderRadius: 4, padding: '2px 5px', flexShrink: 0, marginTop: 2,
  },
  stepT: { fontSize: '0.82rem', fontWeight: 600, color: '#111827', marginBottom: 2 },
  stepD: { fontSize: '0.73rem', color: '#6b7280', lineHeight: 1.4 },

  mailCard: {
    background: '#ffffff', border: '1px solid #e0e4ec', borderRadius: 10,
    padding: '24px', maxWidth: 700, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  mailNotice: {
    display: 'flex', gap: 12, alignItems: 'flex-start',
    background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.2)',
    borderRadius: 8, padding: '14px 16px', marginBottom: 24,
  },
  mailForm:       { display: 'flex', flexDirection: 'column', gap: 16 },
  mailField:      { display: 'flex', flexDirection: 'column', gap: 6 },
  mailAttachRow:  { display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  mailCheck:      { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' },
  mailSuccess: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)',
    borderRadius: 8, padding: '16px', marginBottom: 20,
  },
  mailInstructions: {
    marginTop: 28, padding: '18px 20px', background: '#f9fafb',
    border: '1px solid #e0e4ec', borderRadius: 8,
  },
  code: {
    background: '#f0f2f5', padding: '1px 6px', borderRadius: 4,
    fontFamily: 'monospace', fontSize: '0.8rem', color: '#2563eb',
  },
};
