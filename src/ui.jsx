// ── helpers ──────────────────────────────────────────────────
export const fmt = n =>
  new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(n || 0)) + ' ₴'

export const fmtK = n =>
  Math.abs(n || 0) >= 1000 ? (Math.abs(n) / 1000).toFixed(1) + 'к' : String(Math.abs(n || 0))

export const todayStr = () => new Date().toISOString().split('T')[0]

export const daysUntil = dateStr => {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date(todayStr())) / 86400000)
}

export const overdueLabel = dateStr => {
  const d = daysUntil(dateStr)
  if (d === null) return null
  if (d < 0)  return { text: `Прострочено на ${Math.abs(d)} дн.`, color: '#dc2626' }
  if (d === 0) return { text: 'Сьогодні!', color: '#ea580c' }
  if (d <= 3) return { text: `Через ${d} дн.`, color: '#ca8a04' }
  return { text: `Через ${d} дн.`, color: '#78716c' }
}

export const CATEGORIES = {
  income: [
    { id: 'commission',   label: 'Комісія з бронювань',  icon: '🏨', stream: 'hotel' },
    { id: 'subscription', label: 'Щомісячна підписка',   icon: '📋', stream: 'hotel' },
    { id: 'tourism',      label: 'Туристичні групи',      icon: '🚌', stream: 'tourism' },
  ],
  expense: [
    { id: 'tech',       label: 'Технічні витрати',      icon: '🔧' },
    { id: 'staff',      label: 'Підрядники / зарплати', icon: '👥' },
    { id: 'marketing',  label: 'Реклама / маркетинг',   icon: '📣' },
    { id: 'operations', label: 'Операційні витрати',    icon: '🏢' },
    { id: 'tour_costs', label: 'Витрати на тури',       icon: '🗺️' },
    { id: 'taxes',      label: 'Податки',               icon: '🏛️' },
    { id: 'personal',   label: 'Вивід собі',            icon: '👤' },
  ],
}

export const CAT_COLORS = {
  commission: '#2c5f2e', subscription: '#4a7c59', tourism: '#6b9e7a',
  tech: '#dc2626', staff: '#ea580c', marketing: '#ca8a04',
  operations: '#7c3aed', tour_costs: '#db2777', taxes: '#0f766e',
  personal: '#0891b2',
}

// ── UI primitives ─────────────────────────────────────────────
export function Card({ children, style }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      border: '1px solid #e8e4dc',
      padding: 24,
      boxShadow: '0 2px 8px rgba(0,0,0,.04)',
      ...style
    }}>
      {children}
    </div>
  )
}

export function SectionTitle({ children }) {
  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      fontSize: 11,
      fontWeight: 700,
      color: '#b0a898',
      letterSpacing: 1.8,
      textTransform: 'uppercase',
      marginBottom: 16
    }}>
      {children}
    </div>
  )
}

export function Btn({ children, variant = 'primary', style: s, ...p }) {
  const styles = {
    primary:  { bg: '#2c5f2e', color: '#fff' },
    danger:   { bg: '#dc2626', color: '#fff' },
    success:  { bg: '#16a34a', color: '#fff' },
    ghost:    { bg: '#f5f3ef', color: '#7a7060', border: '1px solid #e8e4dc' },
    outline:  { bg: '#fff',    color: '#2c5f2e', border: '1px solid #2c5f2e' },
    cyan:     { bg: '#0891b2', color: '#fff' },
    purple:   { bg: '#7c3aed', color: '#fff' },
  }
  const v = styles[variant] || styles.primary
  return (
    <button {...p} style={{
      background: v.bg,
      border: v.border || 'none',
      borderRadius: 10,
      padding: '9px 18px',
      color: v.color,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      fontFamily: "'DM Sans', sans-serif",
      transition: 'opacity .15s',
      ...s
    }}
      onMouseEnter={e => e.currentTarget.style.opacity = '.85'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      {children}
    </button>
  )
}

export function Input({ label, ...p }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ fontSize: 11, color: '#78716c', marginBottom: 5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>}
      <input {...p} style={{
        width: '100%',
        background: '#faf9f7',
        border: '1px solid #e8e4dc',
        borderRadius: 10,
        padding: '10px 13px',
        color: '#1a1a1a',
        fontSize: 14,
        outline: 'none',
        boxSizing: 'border-box',
        fontFamily: "'DM Sans', sans-serif",
        ...p.style
      }} />
    </div>
  )
}

export function Select({ label, children, ...p }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ fontSize: 11, color: '#78716c', marginBottom: 5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>}
      <select {...p} style={{
        width: '100%',
        background: '#faf9f7',
        border: '1px solid #e8e4dc',
        borderRadius: 10,
        padding: '10px 13px',
        color: '#1a1a1a',
        fontSize: 14,
        outline: 'none',
        boxSizing: 'border-box',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {children}
      </select>
    </div>
  )
}

export function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 20,
        padding: 32,
        width: 'min(480px,95vw)',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <span style={{ fontFamily: "'Spectral', serif", fontSize: 19, fontWeight: 700, color: '#1a1a1a' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#b0a898', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function StatCard({ icon, label, value, sub, color = '#2c5f2e', alert }) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${color}22`,
      borderRadius: 16,
      padding: '20px 22px',
      flex: 1,
      minWidth: 150,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,.04)'
    }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 64, height: 64, background: `${color}0d`, borderRadius: '0 16px 0 64px' }} />
      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 10, color: '#b0a898', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "'Spectral', serif" }}>{value}</div>
      {sub   && <div style={{ fontSize: 11, color: '#b0a898', marginTop: 4 }}>{sub}</div>}
      {alert && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4, fontWeight: 700 }}>⚠ {alert}</div>}
    </div>
  )
}

export function DebtRow({ item, list, posColor, prefix, payLabel, onPaid, onDelete }) {
  const lbl = overdueLabel(item.due)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 16px',
      background: item.paid ? '#faf9f7' : '#fff',
      borderRadius: 12, marginBottom: 8,
      borderLeft: `3px solid ${item.paid ? '#e8e4dc' : posColor}`,
      border: '1px solid #e8e4dc',
      opacity: item.paid ? .55 : 1,
      boxShadow: '0 1px 4px rgba(0,0,0,.03)'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>{item.name}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
          {item.due && <div style={{ fontSize: 11, color: lbl?.color || '#78716c', fontWeight: 600 }}>📅 {item.due} · {lbl?.text}</div>}
          {item.note && <div style={{ fontSize: 11, color: '#b0a898' }}>{item.note}</div>}
        </div>
      </div>
      <div style={{ fontWeight: 700, color: item.paid ? '#b0a898' : posColor, fontSize: 15, minWidth: 100, textAlign: 'right' }}>
        {prefix}{fmt(item.amount)}
      </div>
      {!item.paid
        ? <Btn variant={list === 'debtors' ? 'success' : 'danger'} style={{ padding: '6px 12px', fontSize: 12, background: list === 'returns' ? '#7c3aed' : undefined }} onClick={onPaid}>✓ {payLabel}</Btn>
        : <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>✓ {payLabel}</span>}
      <button onClick={onDelete} style={{ background: 'none', border: 'none', color: '#d1cdc7', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
    </div>
  )
}
