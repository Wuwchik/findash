import { useState, useEffect, useCallback } from 'react'
import { loadData, saveData, defaultData, loadBankTransactions } from './storage'
import Dashboard from './components/Dashboard'
import Transactions from './components/Transactions'
import Debtors from './components/Debtors'
import Returns from './components/Returns'
import Import from './components/Import'
import Calendar from './components/Calendar'
import Analytics from './components/Analytics'
import Archive from './components/Archive'
import Bank from './components/Bank'

const TABS = [
  { id: 'dashboard',    label: '📊 Дашборд' },
  { id: 'calendar',     label: '📅 Календар' },
  { id: 'transactions', label: '💳 Операції' },
  { id: 'debtors',      label: '📥 Борги' },
  { id: 'returns',      label: '🔄 Повернення' },
  { id: 'analytics',    label: '📈 Аналітика' },
  { id: 'bank', label: '🏦 Банк' },
  { id: 'archive',      label: '🗂 Архів' },
  { id: 'import',       label: '⬆ Імпорт' },
]

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date(new Date().toISOString().split('T')[0])) / 86400000)
}

function formatDate(date) {
  return new Intl.DateTimeFormat('uk', { weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(date)
}

export default function App() {
  const [data, setData] = useState(defaultData)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('dashboard')
  const [currentDate, setCurrentDate] = useState(new Date())

  // Load data from Supabase on mount
  useEffect(() => {
    Promise.all([
      loadData(),
      loadBankTransactions()
    ]).then(([loaded, bankTxns]) => {
      const base = loaded || defaultData()
      const bankAsTransactions = (bankTxns || [])
        .filter(t => t.category)
        .map(t => ({
          id: 'bank_' + t.id,
          type: t.type,
          category: t.category,
          amount: Number(t.amount),
          date: t.date ? t.date.split('T')[0] : '',
          counterparty: t.hotel || t.bank_counterparty || '',
          note: t.description || '',
          fromBank: true
        }))
      const manualIds = new Set((base.transactions || []).map(t => t.id))
      const merged = [
        ...(base.transactions || []),
        ...bankAsTransactions.filter(t => !manualIds.has(t.id))
      ]
      setData({ ...base, transactions: merged })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Update date every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Auto-save daily snapshot at midnight
  useEffect(() => {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setHours(24, 0, 0, 0)
    const msUntilMidnight = midnight - now
    const timer = setTimeout(() => {
      saveDailySnapshot(data)
    }, msUntilMidnight)
    return () => clearTimeout(timer)
  }, [data])

  const save = useCallback((next) => {
    setData(next)
    const toSave = {
      ...next,
      transactions: (next.transactions || []).filter(t => !t.fromBank)
    }
    saveData(toSave)
  }, [])

  const saveDailySnapshot = (currentData) => {
    const dateKey = new Date().toISOString().split('T')[0]
    const snapshots = JSON.parse(localStorage.getItem('findash_snapshots') || '{}')
    const totalIncome = currentData.transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)
    const totalExpBiz = currentData.transactions.filter(t=>t.type==='expense'&&t.category!=='personal').reduce((s,t)=>s+t.amount,0)
    const totalPersonal = currentData.transactions.filter(t=>t.category==='personal').reduce((s,t)=>s+t.amount,0)
    const totalRet = currentData.returns.filter(r=>r.paid).reduce((s,r)=>s+r.amount,0)
    snapshots[dateKey] = {
      date: dateKey,
      balance: currentData.startBalance + totalIncome - totalExpBiz - totalPersonal - totalRet,
      income: totalIncome,
      expense: totalExpBiz,
      personal: totalPersonal,
      netProfit: totalIncome - totalExpBiz - totalRet,
    }
    localStorage.setItem('findash_snapshots', JSON.stringify(snapshots))
  }

  const saveSnapshotNow = () => {
    saveDailySnapshot(data)
  }

  const overdueCount =
    data.debtors.filter(d => !d.paid && d.due && daysUntil(d.due) < 0).length +
    data.creditors.filter(c => !c.paid && c.due && daysUntil(c.due) < 0).length

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#f5f3ef', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ fontFamily:"'Spectral',serif", fontSize:24, fontWeight:700, color:'#2c5f2e' }}>🏨 FinDash</div>
      <div style={{ fontSize:14, color:'#b0a898' }}>Завантаження даних...</div>
    </div>
  )

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
        <div style={{ padding: '12px 0' }}>
          <div style={{ fontFamily: "'Spectral', serif", fontSize: 22, fontWeight: 800, color: '#1a1a1a', letterSpacing: -.3 }}>
            🏨 A.U.R.A
          </div>
          <div style={{ fontFamily: "'Spectral', serif", fontSize: 11, color: '#78716c', fontWeight: 500, marginTop: 1 }}>
            Autonomous Universal Revenue Analyst
          </div>
          <div style={{ fontSize: 11, color: '#1a1a1a', fontWeight: 600, marginTop: 2 }}>
            Фінансовий аналітик доходів
          </div>
          <div style={{ fontSize: 11, color: '#2c5f2e', fontWeight: 600, textTransform: 'capitalize', marginTop: 2 }}>
            {formatDate(currentDate)}
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
        {tab === 'dashboard'    && <Dashboard    data={data} save={save} onSnapshot={saveSnapshotNow} />}
        {tab === 'calendar'     && <Calendar     data={data} />}
        {tab === 'transactions' && <Transactions data={data} save={save} />}
        {tab === 'debtors'      && <Debtors      data={data} save={save} />}
        {tab === 'returns'      && <Returns      data={data} save={save} />}
        {tab === 'analytics'    && <Analytics    data={data} />}
        {tab === 'bank' && <Bank />}
        {tab === 'archive'      && <Archive      data={data} />}
        {tab === 'import'       && <Import       data={data} save={save} />}
      </div>
    </div>
  )
}
