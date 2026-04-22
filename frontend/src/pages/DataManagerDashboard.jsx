import { useState, useRef } from 'react';
import Navbar from '../components/Navbar';
import api from '../utils/api';

export default function DataManagerDashboard() {
  const [file,      setFile]      = useState(null);
  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState('');
  const [history,   setHistory]   = useState([]);

  const [holidayInput, setHolidayInput] = useState('7, 21');
  const [holidayError, setHolidayError] = useState('');

  const inputRef = useRef();

  function parseHolidays(raw) {
    if (!raw.trim()) return { days: [], error: '' };
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    const days = [];
    for (const p of parts) {
      const n = parseInt(p, 10);
      if (isNaN(n) || n < 1 || n > 31) return { days: [], error: `"${p}" is not a valid day (1–31)` };
      days.push(n);
    }
    return { days, error: '' };
  }

  function handleHolidayChange(val) {
    setHolidayInput(val);
    const { error } = parseHolidays(val);
    setHolidayError(error);
  }

  function pickFile(f) {
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls)$/i)) { setError('Please select an .xlsx or .xls file.'); return; }
    setFile(f); setError(''); setResult(null); setProgress(0);
  }

  async function handleUpload() {
    if (!file || uploading) return;
    const { days, error: hErr } = parseHolidays(holidayInput);
    if (hErr) { setHolidayError(hErr); return; }

    setUploading(true); setError(''); setResult(null); setProgress(10);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('holiday_dates', JSON.stringify(days));

    try {
      setProgress(30);
      const res = await api.post('/api/attendance/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,
        onUploadProgress: e => { if (e.total) setProgress(30 + Math.round(e.loaded / e.total * 30)); },
      });
      setProgress(100);
      setResult(res.data);
      setHistory(p => [
        { name: file.name, date: new Date().toLocaleString(), n: res.data.records_inserted, ok: true },
        ...p.slice(0, 9),
      ]);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setProgress(0);
      const d = err.response?.data?.detail;
      setError(typeof d === 'string' ? d : 'Upload failed. Check your file format and try again.');
      setHistory(p => [
        { name: file.name, date: new Date().toLocaleString(), n: 0, ok: false },
        ...p.slice(0, 9),
      ]);
    } finally { setUploading(false); }
  }

  function fmt(b) {
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1048576).toFixed(1)} MB`;
  }

  const parsedDays = parseHolidays(holidayInput).days;

  return (
    <div style={S.page}>
      <Navbar title="DBIT Employee Attendance Tracker" subtitle="Data Manager" />
      <main style={S.main}>

        <div style={S.hdr}>
          <h2 style={S.title}>Upload Attendance File</h2>
          <p style={S.desc}>Supports flat columnar and block-based Excel formats. Configure holidays below before uploading.</p>
        </div>

        {/* Holiday config */}
        <div style={S.holidayCard}>
          <div style={S.holidayHeader}>
            <span style={{ fontSize: '1.1rem' }}>🗓️</span>
            <div>
              <div style={S.holidayTitle}>Holiday Configuration</div>
              <div style={S.holidayDesc}>Enter day numbers (1–31) to exclude as holidays. Sundays are always excluded automatically.</div>
            </div>
          </div>
          <div style={S.holidayRow}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Holiday Days (comma-separated)</label>
              <input
                value={holidayInput}
                onChange={e => handleHolidayChange(e.target.value)}
                placeholder="e.g. 7, 21, 26"
                style={{ ...S.inp, width: '100%', marginTop: 6, borderColor: holidayError ? '#dc2626' : undefined }}
              />
              {holidayError
                ? <div style={S.fieldErr}>{holidayError}</div>
                : <div style={S.fieldHint}>
                    {parsedDays.length > 0 ? `Days excluded: ${parsedDays.join(', ')}` : 'No holidays configured — all working days will be included'}
                  </div>
              }
            </div>
            <div style={S.holidayPreview}>
              {parsedDays.map(d => (
                <span key={d} style={S.dayBadge}>
                  {d}
                  <button onClick={() => {
                    const remaining = parsedDays.filter(x => x !== d);
                    setHolidayInput(remaining.join(', '));
                    setHolidayError('');
                  }} style={S.dayX}>✕</button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div style={S.grid}>
          {/* Drop zone */}
          <div style={S.left}>
            <div
              style={{ ...S.zone, ...(dragging ? S.zoneDrag : {}), cursor: file ? 'default' : 'pointer' }}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]); }}
              onClick={() => !file && inputRef.current?.click()}
            >
              <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                onChange={e => pickFile(e.target.files[0])} />
              {file ? (
                <div style={S.fileRow}>
                  <div style={S.fileIcon}><ExcelSvg /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.fname}>{file.name}</div>
                    <div style={S.fmeta}>{fmt(file.size)} · Ready to upload</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setFile(null); setError(''); setResult(null); }} style={S.xBtn}>✕</button>
                </div>
              ) : (
                <div style={S.dropBody}>
                  <UploadSvg dim={dragging} />
                  <p style={S.dropTxt}>{dragging ? 'Drop file here' : 'Drag & drop Excel file here'}</p>
                  <p style={S.dropSub}>or click to browse — .xlsx / .xls only</p>
                </div>
              )}
            </div>

            {uploading && (
              <div style={S.progWrap}>
                <div style={{ ...S.progBar, width: `${progress}%` }} />
                <span style={S.progLbl}>{progress < 60 ? 'Uploading…' : 'Processing records…'}</span>
              </div>
            )}

            {error && (
              <div style={S.errBox}>
                <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                <div>
                  <b>Upload failed</b>
                  <div style={{ fontSize: '0.82rem', marginTop: 3, lineHeight: 1.5 }}>{error}</div>
                </div>
              </div>
            )}

            {result && (
              <div style={S.okBox}>
                <span style={{ fontSize: '1.3rem' }}>✅</span>
                <div style={{ flex: 1 }}>
                  <b style={{ color: '#059669' }}>Upload successful!</b>
                  <div style={S.statRow}>
                    <Stat n={result.records_processed} lbl="Parsed" />
                    <div style={S.vline} />
                    <Stat n={result.records_inserted} lbl="Stored" c="#059669" />
                    <div style={S.vline} />
                    <Stat n={result.records_processed - result.records_inserted} lbl="Skipped" c="#9ca3af" />
                  </div>
                  {result.holidays_used?.length > 0 && (
                    <div style={{ fontSize: '0.73rem', color: '#9ca3af', marginTop: 4 }}>
                      Holidays excluded: days {result.holidays_used.join(', ')}
                    </div>
                  )}
                  <div style={{ fontSize: '0.73rem', color: '#9ca3af', marginTop: 2 }}>{result.filename}</div>
                </div>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || uploading || !!holidayError}
              style={{ ...S.uploadBtn, opacity: (!file || uploading || !!holidayError) ? 0.5 : 1, cursor: (!file || uploading || !!holidayError) ? 'not-allowed' : 'pointer' }}
            >
              {uploading
                ? <><span className="spinner" style={{ width: 18, height: 18, borderTopColor: '#fff' }} />Processing…</>
                : <><UploadIcon />Upload &amp; Process</>}
            </button>
          </div>

          {/* Side info */}
          <div style={S.right}>
            <InfoCard title="📋 Accepted Column Names">
              <div style={S.colGrid}>
                {[
                  'empcode', 'name', 'department', 'date', 'day',
                  'in_time / in', 'out_time / out', 'work_hour',
                  'status (P or A)', 'early_minutes', 'late_minutes',
                  'reporting_status', 'present_no_days', 'absent_no_days',
                ].map(c => <div key={c} style={S.colTag}>{c}</div>)}
              </div>
              <p style={S.colNote}>Truncated column names and spacing variants are handled automatically.</p>
            </InfoCard>

            <InfoCard title="⚙️ Processing Steps">
              {[
                ['01', 'Detect format',   'Flat rows or per-employee blocks'],
                ['02', 'Map columns',     'Handles truncated / aliased headers'],
                ['03', 'Parse dates',     'Any date format → YYYY-MM-DD'],
                ['04', 'Filter days',     'Remove Sundays + configured holidays'],
                ['05', 'Compute metrics', 'Early/late minutes vs 09:00 cutoff'],
                ['06', 'Aggregate',       'Present & absent day counts'],
                ['07', 'Upsert DB',       'Deduplicate by empcode + date'],
              ].map(([n, t, d]) => (
                <div key={n} style={S.step}>
                  <span style={S.stepN}>{n}</span>
                  <div>
                    <div style={S.stepT}>{t}</div>
                    <div style={S.stepD}>{d}</div>
                  </div>
                </div>
              ))}
            </InfoCard>
          </div>
        </div>

        {history.length > 0 && (
          <div style={S.hist}>
            <div style={S.histTitle}>Session Upload History</div>
            {history.map((h, i) => (
              <div key={i} style={S.histRow}>
                <span>{h.ok ? '✅' : '❌'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.histName}>{h.name}</div>
                  <div style={S.histDate}>{h.date}</div>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: h.ok ? '#059669' : '#dc2626' }}>
                  {h.ok ? `${h.n} records` : 'Failed'}
                </span>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Stat({ n, lbl, c = '#111827' }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: c, fontFamily: 'var(--font-display)' }}>{n}</div>
      <div style={{ fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{lbl}</div>
    </div>
  );
}
function InfoCard({ title, children }) {
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e0e4ec', borderRadius: 10, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}
function UploadSvg({ dim }) {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
      stroke={dim ? '#2563eb' : '#9ca3af'} strokeWidth="1.4" strokeLinecap="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
function ExcelSvg() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: { minHeight: '100vh', background: '#f5f7fa' },
  main: { padding: '28px 32px', maxWidth: 1080, margin: '0 auto' },
  hdr:  { marginBottom: 20 },
  title:{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: '#111827', marginBottom: 8 },
  desc: { color: '#6b7280', fontSize: '0.875rem', lineHeight: 1.65, maxWidth: 540 },

  holidayCard: {
    background: '#ffffff', border: '1px solid #e0e4ec',
    borderRadius: 10, padding: '16px 20px', marginBottom: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  holidayHeader:  { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  holidayTitle:   { fontSize: '0.88rem', fontWeight: 700, color: '#111827', marginBottom: 3 },
  holidayDesc:    { fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.5 },
  holidayRow:     { display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' },
  holidayPreview: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 22 },
  dayBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)',
    borderRadius: 20, padding: '3px 10px', fontSize: '0.8rem', fontWeight: 700, color: '#2563eb',
  },
  dayX: { background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.7rem', padding: '0 0 0 2px', lineHeight: 1 },

  label:    { fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' },
  inp:      { background: '#f9fafb', border: '1px solid #e0e4ec', borderRadius: 8, padding: '8px 12px', color: '#111827', fontSize: '0.88rem' },
  fieldErr: { fontSize: '0.75rem', color: '#dc2626', marginTop: 4 },
  fieldHint:{ fontSize: '0.73rem', color: '#9ca3af', marginTop: 4 },

  grid: { display: 'grid', gridTemplateColumns: '1fr 310px', gap: 22, marginBottom: 22 },
  left: { display: 'flex', flexDirection: 'column', gap: 14 },
  right:{ display: 'flex', flexDirection: 'column', gap: 14 },

  zone: {
    background: '#ffffff', border: '2px dashed #e0e4ec',
    borderRadius: 12, minHeight: 210,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'border-color .2s, background .2s', padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  zoneDrag: { borderColor: '#2563eb', background: 'rgba(37,99,235,0.04)' },
  dropBody: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' },
  dropTxt:  { fontSize: '1rem', fontWeight: 500, color: '#374151', margin: 0 },
  dropSub:  { fontSize: '0.82rem', color: '#9ca3af', margin: 0 },

  fileRow:  { display: 'flex', alignItems: 'center', gap: 14, width: '100%' },
  fileIcon: { width: 48, height: 48, borderRadius: 10, background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  fname:    { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3, color: '#111827' },
  fmeta:    { fontSize: '0.77rem', color: '#6b7280' },
  xBtn:     { background: '#f3f4f6', border: '1px solid #e0e4ec', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0 },

  progWrap: { position: 'relative', height: 6, background: '#f0f2f5', borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  progBar:  { position: 'absolute', left: 0, top: 0, height: '100%', background: '#2563eb', borderRadius: 4, transition: 'width .4s' },
  progLbl:  { position: 'absolute', right: 0, top: 8, fontSize: '0.72rem', color: '#9ca3af' },

  errBox: {
    display: 'flex', gap: 12, alignItems: 'flex-start',
    background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)',
    borderRadius: 8, padding: '14px 16px', color: '#dc2626',
  },
  okBox: {
    display: 'flex', gap: 14, alignItems: 'flex-start',
    background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)',
    borderRadius: 8, padding: '16px',
  },
  statRow: { display: 'flex', alignItems: 'center', gap: 16, marginTop: 10 },
  vline:   { width: 1, height: 32, background: '#e0e4ec' },

  uploadBtn: {
    background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10,
    padding: '13px 24px', fontSize: '0.95rem', fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'opacity .2s',
  },

  colGrid: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  colTag:  { fontSize: '0.72rem', background: '#f3f4f6', border: '1px solid #e0e4ec', borderRadius: 20, padding: '2px 9px', color: '#374151' },
  colNote: { fontSize: '0.75rem', color: '#9ca3af', margin: 0, lineHeight: 1.5 },

  step:  { display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  stepN: { fontSize: '0.6rem', fontWeight: 800, color: '#2563eb', background: 'rgba(37,99,235,0.08)', borderRadius: 4, padding: '2px 5px', flexShrink: 0, marginTop: 2 },
  stepT: { fontSize: '0.82rem', fontWeight: 600, color: '#111827', marginBottom: 2 },
  stepD: { fontSize: '0.73rem', color: '#6b7280', lineHeight: 1.4 },

  hist:     { background: '#ffffff', border: '1px solid #e0e4ec', borderRadius: 10, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  histTitle:{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: 12 },
  histRow:  { display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', background: '#f9fafb', borderRadius: 8, marginBottom: 7, border: '1px solid #e0e4ec' },
  histName: { fontSize: '0.84rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#111827' },
  histDate: { fontSize: '0.71rem', color: '#9ca3af' },
};
