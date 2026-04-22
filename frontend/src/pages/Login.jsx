import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await api.post('/api/auth/login', form);
      login(res.data.access_token, res.data.user);
      if (res.data.user.role === 'principal') navigate('/principal');
      else navigate('/upload');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally { setLoading(false); }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card} className="animate-in">
        <div style={styles.logo}>
          <div style={styles.logoIcon}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="4" width="24" height="20" rx="3" stroke="#2563eb" strokeWidth="2"/>
              <path d="M8 2v4M20 2v4M2 10h24" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/>
              <rect x="7" y="14" width="4" height="4" rx="1" fill="#2563eb"/>
              <rect x="12" y="14" width="4" height="4" rx="1" fill="#2563eb" opacity="0.45"/>
              <rect x="17" y="14" width="4" height="4" rx="1" fill="#2563eb" opacity="0.2"/>
            </svg>
          </div>
          <div>
            <div style={styles.logoText}>DBIT</div>
            <div style={styles.logoSub}>Employee Attendance Tracker</div>
          </div>
        </div>

        <div style={styles.heading}>
          <h1 style={styles.title}>Welcome back</h1>
          <p style={styles.subtitle}>Sign in to your account to continue</p>
        </div>

        {error && (
          <div style={styles.errorBox}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email address</label>
            <input type="email" required value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="you@dbit.edu.in" style={styles.input} />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input type="password" required value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="••••••••" style={styles.input} />
          </div>
          <button type="submit" disabled={loading} style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}>
            {loading ? <span className="spinner" style={{ margin: '0 auto', borderTopColor: '#fff' }} /> : 'Sign In'}
          </button>
        </form>

        <p style={styles.footer}>
          Don't have an account?{' '}
          <Link to="/signup" style={styles.link}>Create one</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px', background: '#f5f7fa',
  },
  card: {
    background: '#ffffff', border: '1px solid #e0e4ec',
    borderRadius: 14, padding: '40px',
    width: '100%', maxWidth: '420px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  },
  logo:    { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' },
  logoIcon:{ width: 46, height: 46, borderRadius: 12, background: 'rgba(37,99,235,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(37,99,235,0.18)' },
  logoText:{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: '#111827', fontWeight: 700 },
  logoSub: { fontSize: '0.7rem', color: '#6b7280', marginTop: 1 },
  heading: { marginBottom: '28px' },
  title:   { fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: '#111827', marginBottom: '6px' },
  subtitle:{ color: '#6b7280', fontSize: '0.9rem' },
  errorBox:{
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)',
    borderRadius: 8, padding: '10px 14px',
    color: '#dc2626', fontSize: '0.875rem', marginBottom: '20px',
  },
  form:   { display: 'flex', flexDirection: 'column', gap: '18px' },
  field:  { display: 'flex', flexDirection: 'column', gap: '6px' },
  label:  { fontSize: '0.78rem', fontWeight: 600, color: '#374151', letterSpacing: '0.03em' },
  input:  { background: '#f9fafb', border: '1px solid #e0e4ec', borderRadius: 8, padding: '11px 14px', color: '#111827', fontSize: '0.95rem', transition: 'border-color 0.2s' },
  btn:    { background: '#2563eb', color: '#fff', borderRadius: 8, padding: '12px', fontSize: '0.95rem', fontWeight: 600, transition: 'opacity 0.2s', marginTop: '4px', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' },
  footer: { textAlign: 'center', marginTop: '24px', color: '#6b7280', fontSize: '0.875rem' },
  link:   { color: '#2563eb', fontWeight: 600 },
};
