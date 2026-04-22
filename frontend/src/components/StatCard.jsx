export default function StatCard({ label, value, sub, color = '#2563eb', icon, trend }) {
  return (
    <div style={styles.card} className="animate-in">
      <div style={styles.top}>
        {icon && (
          <div style={{ ...styles.iconWrap, background: color + '14', border: `1px solid ${color}28` }}>
            <span style={{ color }}>{icon}</span>
          </div>
        )}
        <div style={styles.info}>
          <div style={styles.label}>{label}</div>
          <div style={{ ...styles.value, color }}>{value ?? '—'}</div>
          {sub && <div style={styles.sub}>{sub}</div>}
        </div>
      </div>
      {trend !== undefined && (
        <div style={{ ...styles.trend, color: trend >= 0 ? '#059669' : '#dc2626' }}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: '#ffffff',
    border: '1px solid #e0e4ec',
    borderRadius: 'var(--radius)',
    padding: '18px 20px',
    display: 'flex', flexDirection: 'column', gap: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    transition: 'box-shadow 0.2s',
  },
  top: { display: 'flex', alignItems: 'flex-start', gap: '14px' },
  iconWrap: {
    width: 42, height: 42, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.2rem', flexShrink: 0,
  },
  info: { flex: 1, minWidth: 0 },
  label: {
    fontSize: '0.7rem', fontWeight: 700, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px',
  },
  value: {
    fontSize: '1.75rem', fontWeight: 700, lineHeight: 1,
    fontFamily: 'var(--font-display)',
  },
  sub:   { fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px' },
  trend: { fontSize: '0.73rem', fontWeight: 600 },
};
