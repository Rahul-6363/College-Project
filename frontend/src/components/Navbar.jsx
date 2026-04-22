import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ title, subtitle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const roleBadge = user?.role === 'principal'
    ? { label: 'Principal',    color: '#d97706', bg: 'rgba(217,119,6,0.10)' }
    : { label: 'Data Manager', color: '#059669', bg: 'rgba(5,150,105,0.10)' };

  return (
    <header style={styles.nav}>
      <div style={styles.left}>
        <div style={styles.logoMark}>
          <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="4" width="24" height="20" rx="3" stroke="#2563eb" strokeWidth="2"/>
            <path d="M8 2v4M20 2v4M2 10h24" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/>
            <rect x="7" y="14" width="4" height="4" rx="1" fill="#2563eb"/>
            <rect x="12" y="14" width="4" height="4" rx="1" fill="#2563eb" opacity="0.45"/>
          </svg>
        </div>
        <div>
          <div style={styles.navTitle}>{title || 'DBIT Employee Attendance Tracker'}</div>
          {subtitle && <div style={styles.navSub}>{subtitle}</div>}
        </div>
      </div>
      <div style={styles.right}>
        <span style={{ ...styles.badge, color: roleBadge.color, background: roleBadge.bg }}>
          {roleBadge.label}
        </span>
        <div style={styles.userInfo}>
          <div style={styles.avatar}>{user?.name?.[0]?.toUpperCase() || 'U'}</div>
          <span style={styles.userName}>{user?.name}</span>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn} title="Sign out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </header>
  );
}

const styles = {
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 28px', height: 60,
    background: '#ffffff',
    borderBottom: '1px solid #e0e4ec',
    position: 'sticky', top: 0, zIndex: 100,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  left: { display: 'flex', alignItems: 'center', gap: '12px' },
  logoMark: {
    width: 36, height: 36, borderRadius: 8,
    background: 'rgba(37,99,235,0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid rgba(37,99,235,0.18)',
    flexShrink: 0,
  },
  navTitle: { fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: '#111827', fontWeight: 600 },
  navSub:   { fontSize: '0.72rem', color: '#6b7280', marginTop: 1 },
  right: { display: 'flex', alignItems: 'center', gap: '10px' },
  badge: {
    fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em',
    textTransform: 'uppercase', padding: '3px 9px', borderRadius: 20,
  },
  userInfo: { display: 'flex', alignItems: 'center', gap: '8px' },
  avatar: {
    width: 32, height: 32, borderRadius: '50%',
    background: '#2563eb',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.78rem', fontWeight: 700, color: '#fff',
  },
  userName: { fontSize: '0.85rem', color: '#374151' },
  logoutBtn: {
    background: '#f3f4f6', border: '1px solid #e0e4ec',
    borderRadius: 8, width: 34, height: 34,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#6b7280', cursor: 'pointer',
    transition: 'background 0.15s',
  },
};
