import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fmt, Card, SectionTitle, Input, REVENUE_YEAR_START } from '../ui.jsx'

const weekDf  = new Intl.DateTimeFormat('uk', { day:'numeric', month:'short' })
const monthDf = new Intl.DateTimeFormat('uk', { month:'long', year:'numeric' })
const fullDf  = new Intl.DateTimeFormat('uk', { day:'numeric', month:'long', year:'numeric' })

function mondayOf(d) {
  const nd = new Date(d)
  nd.setDate(nd.getDate() - (nd.getDay() + 6) % 7)
  nd.setHours(0, 0, 0, 0)
  return nd
}

// ── Plan status pill ────────────────────────────────────────────
function PlanStatus({ revenue, goal, isCurrent }) {
  if (isCurrent) return <span style={{ fontSize:11, color:'#0891b2', fontWeight:700 }}>● триває</span>
  if (!goal) return <span style={{ fontSize:11, color:'#b0a898' }}>—</span>
  const pct = Math.round((revenue / goal) * 100)
  return revenue >= goal
    ? <span style={{ fontSize:11, color:'#16a34a', fontWeight:700 }}>✓ виконано ({pct}%)</span>
    : <span style={{ fontSize:11, color:'#dc2626', fontWeight:700 }}>✗ не виконано ({pct}%)</span>
}

// ── Period table (weeks or months) ──────────────────────────────
function PeriodTable({ title, rows, goal }) {
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr 1.3fr', gap:4, marginBottom:8 }}>
        {['Період','Виручка','План','Статус'].map(h=>(
          <div key={h} style={{ fontSize:10, color:'#b0a898', fontWeight:700, letterSpacing:.8, textTransform:'uppercase', padding:'4px 6px' }}>{h}</div>
        ))}
      </div>
      {rows.map((r,i) => (
        <div key={r.key} style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr 1.3fr', gap:4, padding:'8px 6px', background:i%2===0?'#faf9f7':'transparent', borderRadius:8, alignItems:'center' }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#1a1a1a', textTransform:'capitalize' }}>{r.label}</div>
          <div style={{ fontSize:12, color:'#16a34a', fontWeight:700 }}>{fmt(r.revenue)}</div>
          <div style={{ fontSize:12, color:'#b0a898' }}>{fmt(goal)}</div>
          <PlanStatus revenue={r.revenue} goal={goal} isCurrent={r.isCurrent} />
        </div>
      ))}
      {rows.length === 0 && <div style={{ color:'#b0a898', fontSize:13, textAlign:'center', padding:16 }}>Немає даних</div>}
    </Card>
  )
}

export default function Archive({ data, bankTransactions = [] }) {
  const [snapshots, setSnapshots] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('findash_snapshots') || '{}')
    } catch { return {} }
  })
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')

  const bankIncome = useMemo(() => bankTransactions.filter(t => t.type === 'income'), [bankTransactions])

  // ── Тижнева історія (з травня 2026) ──────────────────────────
  const weekRows = useMemo(() => {
    const lastMonday = mondayOf(new Date())
    const rows = []
    let cursor = mondayOf(REVENUE_YEAR_START)
    while (cursor <= lastMonday) {
      const start = new Date(cursor)
      const end = new Date(cursor); end.setDate(end.getDate() + 7) // ексклюзивно
      const revenue = bankIncome
        .filter(t => { const d = new Date(t.date); return d >= start && d < end })
        .reduce((s, t) => s + Number(t.amount), 0)
      const endIncl = new Date(end); endIncl.setDate(endIncl.getDate() - 1)
      rows.push({
        key: start.toISOString(),
        label: `${weekDf.format(start)} – ${weekDf.format(endIncl)}`,
        revenue,
        isCurrent: +start === +lastMonday,
      })
      cursor.setDate(cursor.getDate() + 7)
    }
    return rows.reverse()
  }, [bankIncome])

  // ── Місячна історія (з травня 2026) ──────────────────────────
  const monthRows = useMemo(() => {
    const now = new Date()
    const rows = []
    let y = REVENUE_YEAR_START.getFullYear(), m = REVENUE_YEAR_START.getMonth()
    while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth())) {
      const start = new Date(y, m, 1)
      const end = new Date(y, m + 1, 1)
      const revenue = bankIncome
        .filter(t => { const d = new Date(t.date); return d >= start && d < end })
        .reduce((s, t) => s + Number(t.amount), 0)
      rows.push({
        key: `${y}-${m}`,
        label: monthDf.format(start),
        revenue,
        isCurrent: y === now.getFullYear() && m === now.getMonth(),
      })
      m++; if (m > 11) { m = 0; y++ }
    }
    return rows.reverse()
  }, [bankIncome])

  const yearRevenue = useMemo(
    () => bankIncome.filter(t => new Date(t.date) >= REVENUE_YEAR_START).reduce((s, t) => s + Number(t.amount), 0),
    [bankIncome]
  )

  // ── Довільний період ──────────────────────────────────────────
  const rangeResult = useMemo(() => {
    if (!rangeFrom || !rangeTo) return null
    const start = new Date(rangeFrom); start.setHours(0, 0, 0, 0)
    const end = new Date(rangeTo); end.setHours(23, 59, 59, 999)
    if (end < start) return null
    const revenue = bankIncome
      .filter(t => { const d = new Date(t.date); return d >= start && d <= end })
      .reduce((s, t) => s + Number(t.amount), 0)
    const days = Math.round((end - start) / 86400000) + 1
    const target = (data.goals?.day || 0) * days
    return { revenue, days, target }
  }, [rangeFrom, rangeTo, bankIncome, data.goals])

  const sortedDays = Object.values(snapshots).sort((a,b) => a.date.localeCompare(b.date))

  const chartData = sortedDays.map(s => ({
    date: new Intl.DateTimeFormat('uk', { day:'numeric', month:'short' }).format(new Date(s.date)),
    balance: s.balance,
    income: s.income,
    profit: s.netProfit,
  }))

  const tip = { background:'#fff', border:'1px solid #e8e4dc', borderRadius:10, fontFamily:"'DM Sans',sans-serif", fontSize:12 }

  const saveNow = () => {
    const dateKey = new Date().toISOString().split('T')[0]
    const totalIncome = data.transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)
    const totalExpBiz = data.transactions.filter(t=>t.type==='expense'&&t.category!=='personal').reduce((s,t)=>s+t.amount,0)
    const totalPersonal = data.transactions.filter(t=>t.category==='personal').reduce((s,t)=>s+t.amount,0)
    const totalRet = data.returns.filter(r=>r.paid).reduce((s,r)=>s+r.amount,0)
    const snap = {
      date: dateKey,
      balance: data.startBalance + totalIncome - totalExpBiz - totalPersonal - totalRet,
      income: totalIncome,
      expense: totalExpBiz,
      personal: totalPersonal,
      netProfit: totalIncome - totalExpBiz - totalRet,
    }
    const updated = { ...snapshots, [dateKey]: snap }
    localStorage.setItem('findash_snapshots', JSON.stringify(updated))
    setSnapshots(updated)
  }

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:700, color:'#1a1a1a' }}>🗂 Архів</div>
        <div style={{ fontSize:12, color:'#b0a898', marginTop:2 }}>Історія виконання плану по виручці та знімки фінансового стану</div>
      </div>

      {/* Історія виконання плану */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
        <PeriodTable title="Тижні · виручка vs план" rows={weekRows} goal={data.goals?.week || 0} />
        <PeriodTable title="Місяці · виручка vs план" rows={monthRows} goal={data.goals?.month || 0} />
      </div>

      <Card style={{ marginBottom:14, background:'linear-gradient(135deg,#fff 0%,#faf9f7 100%)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ fontSize:10, color:'#b0a898', fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', marginBottom:4 }}>
              Рік · виручка з {fullDf.format(REVENUE_YEAR_START)}
            </div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:800, color:'#2c5f2e' }}>{fmt(yearRevenue)}</div>
          </div>
        </div>
      </Card>

      {/* Довільний період */}
      <Card style={{ marginBottom:24 }}>
        <SectionTitle>Довільний період</SectionTitle>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end', marginBottom:14 }}>
          <div style={{ minWidth:160 }}>
            <Input label="Від" type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} />
          </div>
          <div style={{ minWidth:160 }}>
            <Input label="До" type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)} />
          </div>
        </div>

        {rangeResult ? (
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:160, background:'#f0fdf4', border:'1px solid #86efac', borderRadius:12, padding:'14px 18px' }}>
              <div style={{ fontSize:10, color:'#16a34a', fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', marginBottom:4 }}>Виручка за період</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:800, color:'#15803d' }}>{fmt(rangeResult.revenue)}</div>
              <div style={{ fontSize:11, color:'#b0a898', marginTop:4 }}>{rangeResult.days} дн.</div>
            </div>
            <div style={{ flex:1, minWidth:160, background:'#faf9f7', border:'1px solid #e8e4dc', borderRadius:12, padding:'14px 18px' }}>
              <div style={{ fontSize:10, color:'#b0a898', fontWeight:700, letterSpacing:1.2, textTransform:'uppercase', marginBottom:4 }}>План (день × дні)</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:800, color:'#78716c' }}>{fmt(rangeResult.target)}</div>
            </div>
            <div style={{ flex:1, minWidth:160, background:'#fff', border:'1px solid #e8e4dc', borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center' }}>
              <PlanStatus revenue={rangeResult.revenue} goal={rangeResult.target} isCurrent={false} />
            </div>
          </div>
        ) : (
          <div style={{ color:'#b0a898', fontSize:13 }}>Оберіть обидві дати, щоб побачити виручку за період</div>
        )}
      </Card>

      {/* Знімки фінансового стану */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:'#1a1a1a' }}>📸 Знімки балансу</div>
          <div style={{ fontSize:12, color:'#b0a898', marginTop:2 }}>Щоденні знімки повного фінансового стану (баланс, прибуток)</div>
        </div>
        <button onClick={saveNow} style={{ background:'#2c5f2e', border:'none', borderRadius:10, padding:'9px 18px', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
          📸 Зберегти знімок сьогодні
        </button>
      </div>

      {sortedDays.length === 0 ? (
        <Card style={{ textAlign:'center', padding:56 }}>
          <div style={{ fontSize:44, marginBottom:14 }}>🗂</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:'#78716c', marginBottom:8 }}>
            Архів знімків поки порожній
          </div>
          <div style={{ fontSize:13, color:'#b0a898', marginBottom:20 }}>
            Натисніть "Зберегти знімок сьогодні" щоб зафіксувати поточний стан.<br/>
            Далі знімки зберігатимуться автоматично щодня опівночі.
          </div>
          <button onClick={saveNow} style={{ background:'#2c5f2e', border:'none', borderRadius:10, padding:'10px 22px', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            📸 Зберегти перший знімок
          </button>
        </Card>
      ) : (
        <>
          {/* Chart */}
          {chartData.length > 1 && (
            <Card style={{ marginBottom:14 }}>
              <SectionTitle>Динаміка балансу</SectionTitle>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#2c5f2e" stopOpacity={.15}/>
                      <stop offset="95%" stopColor="#2c5f2e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8"/>
                  <XAxis dataKey="date" stroke="#d1cdc7" fontSize={12}/>
                  <YAxis stroke="#d1cdc7" fontSize={12} tickFormatter={v=>(v/1000)+'к'}/>
                  <Tooltip formatter={v=>fmt(v)} contentStyle={tip}/>
                  <Area type="monotone" dataKey="balance" name="Баланс" stroke="#2c5f2e" fill="url(#gb)" strokeWidth={2.5}/>
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Table */}
          <Card>
            <SectionTitle>Всі знімки ({sortedDays.length})</SectionTitle>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:4, marginBottom:8 }}>
              {['Дата','Баланс','Доходи','Витрати','Прибуток'].map(h=>(
                <div key={h} style={{ fontSize:10, color:'#b0a898', fontWeight:700, letterSpacing:.8, textTransform:'uppercase', padding:'4px 8px' }}>{h}</div>
              ))}
            </div>
            {[...sortedDays].reverse().map((s,i) => (
              <div key={s.date} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:4, padding:'9px 8px', background:i%2===0?'#faf9f7':'transparent', borderRadius:8, alignItems:'center' }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#1a1a1a' }}>
                  {new Intl.DateTimeFormat('uk', { day:'numeric', month:'short', year:'numeric' }).format(new Date(s.date))}
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:'#2c5f2e', fontFamily:"'Playfair Display',serif" }}>{fmt(s.balance)}</div>
                <div style={{ fontSize:12, color:'#16a34a', fontWeight:600 }}>+{fmt(s.income)}</div>
                <div style={{ fontSize:12, color:'#dc2626' }}>-{fmt(s.expense)}</div>
                <div style={{ fontSize:12, fontWeight:700, color: s.netProfit >= 0 ? '#2c5f2e' : '#dc2626' }}>
                  {s.netProfit >= 0 ? '+' : ''}{fmt(s.netProfit)}
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  )
}
