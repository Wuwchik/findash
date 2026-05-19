import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { fmt, Card, SectionTitle } from '../ui.jsx'

const COLORS = ['#2c5f2e','#4a7c59','#6b9e7a','#ca8a04','#0891b2','#7c3aed','#dc2626','#ea580c','#db2777','#0f766e','#1d4ed8','#92400e']

export default function Analytics({ data }) {
  const [view, setView] = useState('rating') // rating | monthly | yearly

  const txInc = data.transactions.filter(t => t.type === 'income')

  // ── All unique counterparties ──
  const allCPs = [...new Set(txInc.map(t => t.counterparty || 'Невідомий'))].filter(Boolean)

  // ── All unique months ──
  const allMonths = [...new Set(txInc.map(t => t.date?.slice(0,7)).filter(Boolean))].sort()

  // ── Rating: total per counterparty ──
  const rating = allCPs.map(cp => ({
    name: cp,
    total: txInc.filter(t => (t.counterparty || 'Невідомий') === cp).reduce((s,t) => s+t.amount, 0),
    count: txInc.filter(t => (t.counterparty || 'Невідомий') === cp).length,
  })).sort((a,b) => b.total - a.total)

  // ── Monthly per counterparty ──
  const monthlyByCp = allCPs.map(cp => {
    const months = {}
    allMonths.forEach(m => {
      months[m] = txInc.filter(t => (t.counterparty||'Невідомий')===cp && t.date?.slice(0,7)===m).reduce((s,t)=>s+t.amount,0)
    })
    const total = Object.values(months).reduce((s,v)=>s+v,0)
    return { cp, months, total }
  }).filter(r => r.total > 0).sort((a,b) => b.total - a.total)

  // ── Monthly chart data (top 8 by total) ──
  const top8 = rating.slice(0,8).map(r=>r.name)
  const monthChartData = allMonths.map(m => {
    const row = { month: new Intl.DateTimeFormat('uk',{month:'short',year:'2-digit'}).format(new Date(m+'-01')) }
    top8.forEach(cp => {
      row[cp] = txInc.filter(t=>(t.counterparty||'Невідомий')===cp&&t.date?.slice(0,7)===m).reduce((s,t)=>s+t.amount,0)
    })
    return row
  })

  // ── Yearly: per counterparty per year ──
  const allYears = [...new Set(txInc.map(t=>t.date?.slice(0,4)).filter(Boolean))].sort()
  const yearlyByCp = allCPs.map(cp => {
    const years = {}
    allYears.forEach(y => {
      years[y] = txInc.filter(t=>(t.counterparty||'Невідомий')===cp&&t.date?.startsWith(y)).reduce((s,t)=>s+t.amount,0)
    })
    const total = Object.values(years).reduce((s,v)=>s+v,0)
    return { cp, years, total }
  }).filter(r=>r.total>0).sort((a,b)=>b.total-a.total)

  const totalIncome = txInc.reduce((s,t)=>s+t.amount,0)

  const tip = { background:'#fff', border:'1px solid #e8e4dc', borderRadius:10, fontFamily:"'DM Sans',sans-serif", fontSize:12 }

  const TabBtn = ({ id, label }) => (
    <button onClick={()=>setView(id)} style={{
      padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer',
      fontSize:12, fontWeight:600, fontFamily:"'DM Sans',sans-serif",
      background: view===id ? '#2c5f2e' : '#f5f3ef',
      color: view===id ? '#fff' : '#78716c',
      transition:'all .2s'
    }}>{label}</button>
  )

  if (txInc.length === 0) return (
    <Card style={{ textAlign:'center', padding:56 }}>
      <div style={{ fontSize:44, marginBottom:14 }}>📈</div>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:'#78716c' }}>
        Аналітика з'явиться після внесення доходів
      </div>
    </Card>
  )

  return (
    <div>
      {/* Tab switcher */}
      <div style={{ display:'flex', gap:8, marginBottom:22, flexWrap:'wrap' }}>
        <TabBtn id="rating"  label="🏆 Рейтинг контрагентів"/>
        <TabBtn id="monthly" label="📅 По місяцях"/>
        <TabBtn id="yearly"  label="📆 Річний звіт"/>
      </div>

      {/* ── RATING ── */}
      {view === 'rating' && <>
        <Card style={{ marginBottom:14 }}>
          <SectionTitle>🏆 Топ контрагентів за доходом</SectionTitle>
          <ResponsiveContainer width="100%" height={Math.max(300, rating.length * 36)}>
            <BarChart data={rating} layout="vertical" margin={{ left:20, right:60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" horizontal={false}/>
              <XAxis type="number" stroke="#d1cdc7" fontSize={11} tickFormatter={v=>(v/1000)+'к'}/>
              <YAxis type="category" dataKey="name" stroke="#b0a898" fontSize={11} width={120}/>
              <Tooltip formatter={v=>fmt(v)} contentStyle={tip}/>
              <Bar dataKey="total" name="Дохід" radius={[0,5,5,0]}>
                {rating.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionTitle>Детальна таблиця</SectionTitle>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4, marginBottom:8 }}>
            {['Контрагент','Дохід','% від загального','Операцій'].map(h=>(
              <div key={h} style={{ fontSize:10, color:'#b0a898', fontWeight:700, letterSpacing:.8, textTransform:'uppercase', padding:'4px 8px' }}>{h}</div>
            ))}
          </div>
          {rating.map((r,i)=>(
            <div key={r.name} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4, padding:'9px 8px', background:i%2===0?'#faf9f7':'transparent', borderRadius:8, alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:10, height:10, borderRadius:2, background:COLORS[i%COLORS.length], flexShrink:0 }}/>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>{r.name}</div>
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:'#2c5f2e', fontFamily:"'Playfair Display',serif" }}>+{fmt(r.total)}</div>
              <div style={{ fontSize:12, color:'#78716c' }}>
                <div style={{ background:'#f0ede8', borderRadius:20, height:6, marginBottom:3 }}>
                  <div style={{ background:COLORS[i%COLORS.length], borderRadius:20, height:6, width:`${Math.min(100,(r.total/totalIncome)*100)}%` }}/>
                </div>
                {((r.total/totalIncome)*100).toFixed(1)}%
              </div>
              <div style={{ fontSize:12, color:'#b0a898' }}>{r.count} шт.</div>
            </div>
          ))}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:4, padding:'10px 8px', borderTop:'2px solid #e8e4dc', marginTop:6 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#78716c' }}>Разом</div>
            <div style={{ fontSize:13, fontWeight:800, color:'#2c5f2e', fontFamily:"'Playfair Display',serif" }}>+{fmt(totalIncome)}</div>
            <div style={{ fontSize:12, color:'#78716c' }}>100%</div>
            <div style={{ fontSize:12, color:'#b0a898' }}>{txInc.length} шт.</div>
          </div>
        </Card>
      </>}

      {/* ── MONTHLY ── */}
      {view === 'monthly' && <>
        {allMonths.length > 0 && (
          <Card style={{ marginBottom:14 }}>
            <SectionTitle>Топ-8 контрагентів · динаміка по місяцях</SectionTitle>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8"/>
                <XAxis dataKey="month" stroke="#d1cdc7" fontSize={12}/>
                <YAxis stroke="#d1cdc7" fontSize={12} tickFormatter={v=>(v/1000)+'к'}/>
                <Tooltip formatter={v=>fmt(v)} contentStyle={tip}/>
                {top8.map((cp,i)=>(
                  <Bar key={cp} dataKey={cp} stackId="a" fill={COLORS[i%COLORS.length]} radius={i===top8.length-1?[4,4,0,0]:[0,0,0,0]}/>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        <Card>
          <SectionTitle>Доходи по контрагентах · по місяцях</SectionTitle>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign:'left', padding:'8px 10px', color:'#b0a898', fontWeight:700, letterSpacing:.8, textTransform:'uppercase', fontSize:10, borderBottom:'2px solid #e8e4dc', position:'sticky', left:0, background:'#fff' }}>Контрагент</th>
                  {allMonths.map(m=>(
                    <th key={m} style={{ padding:'8px 10px', color:'#b0a898', fontWeight:700, fontSize:10, textTransform:'uppercase', borderBottom:'2px solid #e8e4dc', whiteSpace:'nowrap', textAlign:'right' }}>
                      {new Intl.DateTimeFormat('uk',{month:'short',year:'2-digit'}).format(new Date(m+'-01'))}
                    </th>
                  ))}
                  <th style={{ padding:'8px 10px', color:'#2c5f2e', fontWeight:700, fontSize:10, textTransform:'uppercase', borderBottom:'2px solid #e8e4dc', textAlign:'right' }}>Разом</th>
                </tr>
              </thead>
              <tbody>
                {monthlyByCp.map((row,i)=>(
                  <tr key={row.cp} style={{ background:i%2===0?'#faf9f7':'transparent' }}>
                    <td style={{ padding:'9px 10px', fontWeight:600, color:'#1a1a1a', position:'sticky', left:0, background:i%2===0?'#faf9f7':'#fff', borderRight:'1px solid #e8e4dc' }}>{row.cp}</td>
                    {allMonths.map(m=>(
                      <td key={m} style={{ padding:'9px 10px', textAlign:'right', color:row.months[m]>0?'#2c5f2e':'#d1cdc7', fontWeight:row.months[m]>0?600:400 }}>
                        {row.months[m]>0 ? '+'+fmt(row.months[m]) : '—'}
                      </td>
                    ))}
                    <td style={{ padding:'9px 10px', textAlign:'right', fontWeight:800, color:'#2c5f2e', fontFamily:"'Playfair Display',serif" }}>+{fmt(row.total)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop:'2px solid #e8e4dc' }}>
                  <td style={{ padding:'10px', fontWeight:700, color:'#78716c', position:'sticky', left:0, background:'#fff', borderRight:'1px solid #e8e4dc' }}>Разом</td>
                  {allMonths.map(m=>(
                    <td key={m} style={{ padding:'10px', textAlign:'right', fontWeight:700, color:'#16a34a' }}>
                      +{fmt(txInc.filter(t=>t.date?.slice(0,7)===m).reduce((s,t)=>s+t.amount,0))}
                    </td>
                  ))}
                  <td style={{ padding:'10px', textAlign:'right', fontWeight:800, color:'#2c5f2e', fontFamily:"'Playfair Display',serif", fontSize:14 }}>+{fmt(totalIncome)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </>}

      {/* ── YEARLY ── */}
      {view === 'yearly' && <>
        <Card style={{ marginBottom:14 }}>
          <SectionTitle>Річний звіт по контрагентах</SectionTitle>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign:'left', padding:'8px 10px', color:'#b0a898', fontWeight:700, fontSize:10, textTransform:'uppercase', borderBottom:'2px solid #e8e4dc' }}>Контрагент</th>
                  {allYears.map(y=>(
                    <th key={y} style={{ padding:'8px 10px', color:'#b0a898', fontWeight:700, fontSize:10, textTransform:'uppercase', borderBottom:'2px solid #e8e4dc', textAlign:'right' }}>{y}</th>
                  ))}
                  <th style={{ padding:'8px 10px', color:'#2c5f2e', fontWeight:700, fontSize:10, textTransform:'uppercase', borderBottom:'2px solid #e8e4dc', textAlign:'right' }}>Всього</th>
                  <th style={{ padding:'8px 10px', color:'#b0a898', fontWeight:700, fontSize:10, textTransform:'uppercase', borderBottom:'2px solid #e8e4dc', textAlign:'right' }}>Частка</th>
                </tr>
              </thead>
              <tbody>
                {yearlyByCp.map((row,i)=>(
                  <tr key={row.cp} style={{ background:i%2===0?'#faf9f7':'transparent' }}>
                    <td style={{ padding:'9px 10px', fontWeight:600, color:'#1a1a1a' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:8, height:8, borderRadius:2, background:COLORS[i%COLORS.length], flexShrink:0 }}/>
                        {row.cp}
                      </div>
                    </td>
                    {allYears.map(y=>(
                      <td key={y} style={{ padding:'9px 10px', textAlign:'right', color:row.years[y]>0?'#2c5f2e':'#d1cdc7', fontWeight:row.years[y]>0?600:400 }}>
                        {row.years[y]>0 ? '+'+fmt(row.years[y]) : '—'}
                      </td>
                    ))}
                    <td style={{ padding:'9px 10px', textAlign:'right', fontWeight:800, color:'#2c5f2e', fontFamily:"'Playfair Display',serif" }}>+{fmt(row.total)}</td>
                    <td style={{ padding:'9px 10px', textAlign:'right' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'flex-end' }}>
                        <div style={{ background:'#f0ede8', borderRadius:20, height:5, width:60 }}>
                          <div style={{ background:COLORS[i%COLORS.length], borderRadius:20, height:5, width:`${Math.min(100,(row.total/totalIncome)*100)}%` }}/>
                        </div>
                        <span style={{ color:'#78716c', fontSize:11 }}>{((row.total/totalIncome)*100).toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop:'2px solid #e8e4dc' }}>
                  <td style={{ padding:'10px', fontWeight:700, color:'#78716c' }}>Разом</td>
                  {allYears.map(y=>(
                    <td key={y} style={{ padding:'10px', textAlign:'right', fontWeight:700, color:'#16a34a' }}>
                      +{fmt(txInc.filter(t=>t.date?.startsWith(y)).reduce((s,t)=>s+t.amount,0))}
                    </td>
                  ))}
                  <td style={{ padding:'10px', textAlign:'right', fontWeight:800, color:'#2c5f2e', fontFamily:"'Playfair Display',serif", fontSize:14 }}>+{fmt(totalIncome)}</td>
                  <td style={{ padding:'10px', textAlign:'right', color:'#78716c', fontSize:11 }}>100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Top 3 insight */}
        <Card>
          <SectionTitle>💡 Ключові інсайти</SectionTitle>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12 }}>
            {rating.slice(0,3).map((r,i)=>(
              <div key={r.name} style={{ background:'#faf9f7', borderRadius:12, padding:'14px 16px', borderLeft:`3px solid ${COLORS[i]}` }}>
                <div style={{ fontSize:10, color:'#b0a898', letterSpacing:1, textTransform:'uppercase', marginBottom:4 }}>
                  {i===0?'🥇 Найкращий':i===1?'🥈 Другий':'🥉 Третій'}
                </div>
                <div style={{ fontSize:14, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>{r.name}</div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:800, color:COLORS[i] }}>+{fmt(r.total)}</div>
                <div style={{ fontSize:11, color:'#b0a898', marginTop:2 }}>{((r.total/totalIncome)*100).toFixed(1)}% доходів · {r.count} оплат</div>
              </div>
            ))}
          </div>
        </Card>
      </>}
    </div>
  )
}
