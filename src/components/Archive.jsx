import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { fmt, Card, SectionTitle } from '../ui.jsx'

export default function Archive({ data }) {
  const [snapshots, setSnapshots] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('findash_snapshots') || '{}')
    } catch { return {} }
  })

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
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:700, color:'#1a1a1a' }}>🗂 Архів дашбордів</div>
          <div style={{ fontSize:12, color:'#b0a898', marginTop:2 }}>Щоденні знімки фінансового стану</div>
        </div>
        <button onClick={saveNow} style={{ background:'#2c5f2e', border:'none', borderRadius:10, padding:'9px 18px', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
          📸 Зберегти знімок сьогодні
        </button>
      </div>

      {sortedDays.length === 0 ? (
        <Card style={{ textAlign:'center', padding:56 }}>
          <div style={{ fontSize:44, marginBottom:14 }}>🗂</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:'#78716c', marginBottom:8 }}>
            Архів поки порожній
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
