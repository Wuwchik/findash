import { useState, useEffect } from 'react'
import { loadBankTransactions, updateBankTransaction, syncPrivatBank } from '../storage'
import { fmt, CATEGORIES, Card, SectionTitle, Btn } from '../ui.jsx'
import { HOTELS } from '../counterparties.js'

const fmtDate = ds => ds ? new Intl.DateTimeFormat('uk', { day:'numeric', month:'short', year:'numeric' }).format(new Date(ds)) : ''

export default function Bank({ onImportToMain }) {
  const [txns, setTxns] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [filter, setFilter] = useState('all') // all | uncategorized | income | expense
  const [syncResult, setSyncResult] = useState(null)

  const load = async () => {
    setLoading(true)
    const data = await loadBankTransactions()
    setTxns(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    const result = await syncPrivatBank()
    setSyncResult(result)
    await load()
    setSyncing(false)
  }

  const setField = async (id, field, value) => {
    setTxns(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
    await updateBankTransaction(id, { [field]: value })
  }

  const filtered = txns.filter(t => {
    if (filter === 'uncategorized') return !t.category || !t.hotel
    if (filter === 'income') return t.type === 'income'
    if (filter === 'expense') return t.type === 'expense'
    return true
  })

  const uncategorizedCount = txns.filter(t => !t.category || (t.type === 'income' && !t.hotel)).length
  const totalIncome = txns.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount), 0)
  const totalExpense = txns.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0)

  const expenseCategories = CATEGORIES.expense
  const incomeCategories = CATEGORIES.income

  if (loading) return (
    <Card style={{ textAlign:'center', padding:48 }}>
      <div style={{ fontSize:14, color:'#b0a898' }}>Завантаження банківських транзакцій...</div>
    </Card>
  )

  return (
    <div>
      {/* Header with sync */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:20, fontWeight:700, color:'#1a1a1a' }}>🏦 Банк · ПриватБанк</div>
          <div style={{ fontSize:12, color:'#b0a898', marginTop:2 }}>
            {txns.length} транзакцій · {uncategorizedCount > 0 ? `${uncategorizedCount} без категорії` : 'всі оброблені ✓'}
          </div>
        </div>
        <Btn onClick={handleSync} disabled={syncing} style={{ background: syncing ? '#b0a898' : '#2c5f2e' }}>
          {syncing ? '⏳ Синхронізація...' : '🔄 Оновити з банку'}
        </Btn>
      </div>

      {syncResult && (
        <div style={{ background: syncResult.success ? '#f0fdf4' : '#fef2f2', border:`1px solid ${syncResult.success ? '#86efac' : '#fecaca'}`, borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13, color: syncResult.success ? '#15803d' : '#dc2626' }}>
          {syncResult.success ? `✓ Оновлено. Всього ${syncResult.total}, збережено нових ${syncResult.saved}` : `Помилка: ${syncResult.error}`}
        </div>
      )}

      {/* Summary */}
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:150, background:'#fff', border:'1px solid #e8e4dc', borderRadius:12, padding:'14px 18px', borderLeft:'3px solid #16a34a' }}>
          <div style={{ fontSize:10, color:'#b0a898', letterSpacing:1.2, textTransform:'uppercase', marginBottom:4 }}>Надходження</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:'#16a34a' }}>+{fmt(totalIncome)}</div>
        </div>
        <div style={{ flex:1, minWidth:150, background:'#fff', border:'1px solid #e8e4dc', borderRadius:12, padding:'14px 18px', borderLeft:'3px solid #dc2626' }}>
          <div style={{ fontSize:10, color:'#b0a898', letterSpacing:1.2, textTransform:'uppercase', marginBottom:4 }}>Витрати</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:'#dc2626' }}>-{fmt(totalExpense)}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {[
          ['all', `Всі (${txns.length})`],
          ['uncategorized', `🏷 Без категорії (${uncategorizedCount})`],
          ['income', 'Надходження'],
          ['expense', 'Витрати'],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} style={{
            padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
            fontFamily:"'DM Sans',sans-serif",
            background: filter === id ? '#2c5f2e' : '#f5f3ef',
            color: filter === id ? '#fff' : '#78716c'
          }}>{label}</button>
        ))}
      </div>

      {/* Transactions list */}
      {filtered.map(t => {
        const needsAttention = !t.category || (t.type === 'income' && !t.hotel)
        return (
          <div key={t.id} style={{
            background:'#fff', border:'1px solid #e8e4dc', borderRadius:12, padding:'14px 16px', marginBottom:8,
            borderLeft:`3px solid ${t.type === 'income' ? '#16a34a' : '#dc2626'}`,
            boxShadow:'0 1px 4px rgba(0,0,0,.03)'
          }}>
            {/* Top row */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:10, flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {t.bank_counterparty || '—'}
                </div>
                <div style={{ fontSize:11, color:'#b0a898', marginTop:2 }}>
                  {fmtDate(t.date)} · {t.description}
                </div>
              </div>
              <div style={{ fontSize:16, fontWeight:700, color: t.type === 'income' ? '#16a34a' : '#dc2626', whiteSpace:'nowrap' }}>
                {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
              </div>
            </div>

            {/* Category + Hotel selectors */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              <select
                value={t.category || ''}
                onChange={e => setField(t.id, 'category', e.target.value)}
                style={{
                  background: t.category ? '#f0fdf4' : '#fef9e7',
                  border:`1px solid ${t.category ? '#86efac' : '#fde68a'}`,
                  borderRadius:8, padding:'6px 10px', fontSize:12, outline:'none',
                  color:'#1a1a1a', fontFamily:"'DM Sans',sans-serif", cursor:'pointer'
                }}
              >
                <option value="">🏷 Категорія...</option>
                {(t.type === 'income' ? incomeCategories : expenseCategories).map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                ))}
              </select>

              {t.type === 'income' && (
                <select
                  value={t.hotel || ''}
                  onChange={e => setField(t.id, 'hotel', e.target.value)}
                  style={{
                    background: t.hotel ? '#f0fdf4' : '#fef9e7',
                    border:`1px solid ${t.hotel ? '#86efac' : '#fde68a'}`,
                    borderRadius:8, padding:'6px 10px', fontSize:12, outline:'none',
                    color:'#1a1a1a', fontFamily:"'DM Sans',sans-serif", cursor:'pointer', minWidth:160
                  }}
                >
                  <option value="">🏨 Готель...</option>
                  {HOTELS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              )}

              {needsAttention
                ? <span style={{ fontSize:11, color:'#ca8a04', fontWeight:600 }}>⚠ Потребує уваги</span>
                : <span style={{ fontSize:11, color:'#16a34a', fontWeight:600 }}>✓ Оброблено</span>
              }
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign:'center', padding:40, color:'#b0a898', fontSize:14 }}>
          {filter === 'uncategorized' ? 'Всі транзакції оброблені! 🎉' : 'Немає транзакцій'}
        </div>
      )}
    </div>
  )
}
