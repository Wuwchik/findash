import { useState, useEffect, useCallback } from 'react'
import { loadData, saveData, defaultData } from './storage'
import Dashboard from './components/Dashboard'
import Transactions from './components/Transactions'
import Debtors from './components/Debtors'
import Returns from './components/Returns'
import Import from './components/Import'
import Calendar from './components/Calendar'
import Analytics from './components/Analytics'

const TABS = [
  { id: 'dashboard', label: '📊 Дашборд' },
  { id: 'calendar',  label: '📅 Календар' },
  { id: 'transactions', label: '💳 Операції' },
  { id: 'debtors',   label: '📥 Борги' },
  { id: 'returns',   label: '🔄 Повернення' },
  { id: 'import',    label: '⬆ Імпорт' },
  { id: 'analytics', label: '📈 Аналітика' },
]

export default function App() {
  const [data, setData] = useState(() => loadData() || defaultData())
  const [tab, setTab] = useState('dashboard')

  const save = useCallback((next) => {
    setData(next)
    saveData(next)
  }, [])

  const overdueCount =
    data.debtors.filter(d => !d.paid && d.due && daysUntil(d.due) < 0).length +
    data.creditors.filter(c => !c.paid && c.due && daysUntil(c.due) < 0).length

  return (
    <div style={{ minHeight: '100vh', background: '#f5f3ef' }}>
      {/* NAV */}
      <nav style={{
        background: '#fff',
        borderBottom: '1px solid #e8e4dc',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 12px rgba(0,0,0,.06)'
      }}>
        <div style={{ padding: '14px 0' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 800, color: '#1a1a1a', letterSpacing: -.3 }}>
            🏨 FinDash
          </div>
          <div style={{ fontSize: 10, color: '#b0a898', letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Готельний бізнес · Фінансовий облік
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', padding: '8px 0' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              background: tab === t.id ? '#2c5f2e' : 'transparent',
              color: tab === t.id ? '#fff' : '#7a7060',
              transition: 'all .2s',
            }}>
              {t.id === 'debtors' && overdueCount > 0 ? `${t.label} (${overdueCount})` : t.label}
            </button>
          ))}
        </div>
      </nav>

      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '28px 16px' }}>
        {tab === 'dashboard'     && <Dashboard    data={data} save={save} />}
        {tab === 'calendar'      && <Calendar     data={data} />}
        {tab === 'transactions'  && <Transactions data={data} save={save} />}
        {tab === 'debtors'       && <Debtors      data={data} save={save} />}
        {tab === 'returns'       && <Returns      data={data} save={save} />}
        {tab === 'import'        && <Import       data={data} save={save} />}
        {tab === 'analytics'     && <Analytics    data={data} />}
      </div>
    </div>
  )
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date(new Date().toISOString().split('T')[0])) / 86400000)
}
