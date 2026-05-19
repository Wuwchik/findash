import { useState } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts'
import { fmt, fmtK, todayStr, daysUntil, CATEGORIES, CAT_COLORS, Card, SectionTitle, StatCard, Btn, Input } from '../ui.jsx'

// ── Goal Ring ─────────────────────────────────────────────────
function GoalRing({ label, current, goal, color, yearMode }) {
  const pct = yearMode ? 0 : Math.min(100, goal > 0 ? (current / goal) * 100 : 0)
  const r = 42, sw = 7
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const isOver = !yearMode && current >= goal

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 100 }}>
      <div style={{ position: 'relative', width: 96, height: 96 }}>
        <svg width={96} height={96} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={48} cy={48} r={r} fill="none" stroke="#f0ede8" strokeWidth={sw} />
          {!yearMode && (
            <circle cx={48} cy={48} r={r} fill="none"
              stroke={isOver ? '#16a34a' : color}
              strokeWidth={sw}
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray .7s ease' }}
            />
          )}
          {yearMode && (
            <circle cx={48} cy={48} r={r} fill="none"
              stroke={color} strokeWidth={sw}
              strokeDasharray={`${circ * 0.12} ${circ}`}
              strokeLinecap="round" opacity={0.35}
            />
          )}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {yearMode ? (
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 12, fontWeight: 700, color, textAlign: 'center', lineHeight: 1.2 }}>
              {fmtK(current)}<br /><span style={{ fontSize: 9, color: '#b0a898' }}>₴</span>
            </div>
          ) : (
            <>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 800, color: isOver ? '#16a34a' : '#1a1a1a', lineHeight: 1 }}>
                {isOver ? '✓' : `${Math.round(pct)}%`}
              </div>
              <div style={{ fontSize: 10, color: '#b0a898', marginTop: 2 }}>{fmtK(current)}</div>
            </>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#78716c', letterSpacing: .8, textTransform: 'uppercase', textAlign: 'center' }}>{label}</div>
      {!yearMode && <div style={{ fontSize: 10, color: '#d1cdc7' }}>план {fmtK(goal)}</div>}
    </div>
  )
}

// ── Goals Banner ─────────────────────────────────────────────
function GoalsBanner({ data, metrics, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.goals)
  const g = data.goals

  return (
    <Card style={{ marginBottom: 20, background: 'linear-gradient(135deg,#fff 0%,#faf9f7 100%)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>
          🎯 Виконання плану
        </div>
        <Btn variant="ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => { setDraft(data.goals); setEditing(true) }}>
          Змінити плани
        </Btn>
      </div>

      {/* Rings */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-around', flexWrap: 'wrap', marginBottom: 20 }}>
        <GoalRing label="День"    current={metrics.todayIncome} goal={g.day}   color="#2c5f2e" />
        <GoalRing label="Тиждень" current={metrics.weekIncome}  goal={g.week}  color="#7c3aed" />
        <GoalRing label="Місяць"  current={metrics.monthIncome} goal={g.month} color="#ca8a04" />
        <div style={{ width: 1, background: '#f0ede8', margin: '8px 4px' }} />
        <GoalRing label="Рік · Прибуток" current={metrics.yearNetProfit} goal={0} color="#16a34a" yearMode />
      </div>

      {/* Hotel / Tourism / Personal strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        {[
          { icon: '🏨', label: 'Готельний бізнес · місяць', value: metrics.mHotelIncome, sub: `витрати ${fmt(metrics.mHotelExp)} · прибуток ${fmt(metrics.mHotelIncome - metrics.mHotelExp)}`, color: '#2c5f2e' },
          { icon: '🚌', label: 'Туризм · місяць',           value: metrics.mTourismIncome, sub: `витрати ${fmt(metrics.mTourismExp)} · прибуток ${fmt(metrics.mTourismIncome - metrics.mTourismExp)}`, color: '#4a7c59' },
          { icon: '👤', label: 'Вивів собі · місяць',       value: metrics.mPersonal, sub: 'з чистого прибутку', color: '#0891b2' },
        ].map(item => (
          <div key={item.label} style={{ background: '#faf9f7', borderRadius: 12, padding: '12px 14px', borderLeft: `3px solid ${item.color}`, border: '1px solid #e8e4dc' }}>
            <div style={{ fontSize: 10, color: '#b0a898', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{item.icon} {item.label}</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: item.color }}>{fmt(item.value)}</div>
            <div style={{ fontSize: 11, color: '#b0a898', marginTop: 3 }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 'min(380px,95vw)', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 700, marginBottom: 22 }}>🎯 Змінити плани</div>
            {[['day','День (₴)'],['week','Тиждень (₴)'],['month','Місяць (₴)']].map(([k, l]) => (
              <Input key={k} label={l} type="number" value={draft[k]}
                onChange={e => setDraft(p => ({ ...p, [k]: parseFloat(e.target.value) || 0 }))} />
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Btn onClick={() => { onSave(draft); setEditing(false) }}>Зберегти</Btn>
              <Btn variant="ghost" onClick={() => setEditing(false)}>Скасувати</Btn>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// ── Dashboard ─────────────────────────────────────────────────
export default function Dashboard({ data, save }) {
  const now = new Date()
  const dayStr = todayStr()
  const dayOfWeek = (now.getDay() + 6) % 7
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - dayOfWeek); weekStart.setHours(0,0,0,0)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const yearStart  = new Date(now.getFullYear(), 0, 1)

  const inPeriod = (ds, from) => new Date(ds) >= from

  const txInc = data.transactions.filter(t => t.type === 'income')
  const txExp = data.transactions.filter(t => t.type === 'expense')

  const totalIncome  = txInc.reduce((s, t) => s + t.amount, 0)
  const totalExpense = txExp.filter(t => t.category !== 'personal').reduce((s, t) => s + t.amount, 0)
  const totalPersonal= txExp.filter(t => t.category === 'personal').reduce((s, t) => s + t.amount, 0)
  const totalReturns = data.returns.filter(r => r.paid).reduce((s, r) => s + r.amount, 0)
  const balance      = data.startBalance + totalIncome - totalExpense - totalPersonal - totalReturns
  const netProfit    = totalIncome - totalExpense - totalReturns

  const todayIncome  = txInc.filter(t => t.date === dayStr).reduce((s, t) => s + t.amount, 0)
  const weekIncome   = txInc.filter(t => inPeriod(t.date, weekStart)).reduce((s, t) => s + t.amount, 0)
  const monthIncome  = txInc.filter(t => inPeriod(t.date, monthStart)).reduce((s, t) => s + t.amount, 0)

  const mHotelIncome  = txInc.filter(t => inPeriod(t.date, monthStart) && t.category !== 'tourism').reduce((s,t)=>s+t.amount,0)
  const mTourismIncome= txInc.filter(t => inPeriod(t.date, monthStart) && t.category === 'tourism').reduce((s,t)=>s+t.amount,0)
  const mHotelExp     = txExp.filter(t => inPeriod(t.date, monthStart) && !['personal','tour_costs'].includes(t.category)).reduce((s,t)=>s+t.amount,0)
  const mTourismExp   = txExp.filter(t => inPeriod(t.date, monthStart) && t.category === 'tour_costs').reduce((s,t)=>s+t.amount,0)
  const mPersonal     = txExp.filter(t => inPeriod(t.date, monthStart) && t.category === 'personal').reduce((s,t)=>s+t.amount,0)

  const yearIncome    = txInc.filter(t => inPeriod(t.date, yearStart)).reduce((s,t)=>s+t.amount,0)
  const yearExpense   = txExp.filter(t => inPeriod(t.date, yearStart) && t.category !== 'personal').reduce((s,t)=>s+t.amount,0)
  const yearPersonal  = txExp.filter(t => inPeriod(t.date, yearStart) && t.category === 'personal').reduce((s,t)=>s+t.amount,0)
  const yearNetProfit = yearIncome - yearExpense - totalReturns + yearPersonal

  const pendingDebt   = data.debtors.filter(d=>!d.paid).reduce((s,d)=>s+d.amount,0)
  const pendingCred   = data.creditors.filter(c=>!c.paid).reduce((s,c)=>s+c.amount,0)
  const pendingRet    = data.returns.filter(r=>!r.paid).reduce((s,r)=>s+r.amount,0)
  const overdueDeb    = data.debtors.filter(d=>!d.paid&&d.due&&daysUntil(d.due)<0).length
  const overdueCred   = data.creditors.filter(c=>!c.paid&&c.due&&daysUntil(c.due)<0).length

  // Charts
  const monthMap = {}
  data.transactions.forEach(t => {
    const m = t.date?.slice(0,7); if (!m) return
    if (!monthMap[m]) monthMap[m] = { month: m, hotel: 0, tourism: 0, expense: 0 }
    if (t.type === 'income') {
      if (t.category === 'tourism') monthMap[m].tourism += t.amount
      else monthMap[m].hotel += t.amount
    } else if (t.category !== 'personal') monthMap[m].expense += t.amount
  })
  const chartData = Object.values(monthMap).sort((a,b)=>a.month.localeCompare(b.month)).map(d => ({
    ...d,
    income: d.hotel + d.tourism,
    profit: d.hotel + d.tourism - d.expense,
    month: new Intl.DateTimeFormat('uk', { month: 'short', year: '2-digit' }).format(new Date(d.month+'-01'))
  }))

  const catTotals = {}
  data.transactions.forEach(t => { catTotals[t.category] = (catTotals[t.category]||0) + t.amount })
  const pieData = Object.entries(catTotals).map(([k,v]) => ({
    name: [...CATEGORIES.income,...CATEGORIES.expense].find(c=>c.id===k)?.label || k,
    value: v, color: CAT_COLORS[k] || '#78716c'
  }))

  const tooltipStyle = { background:'#fff', border:'1px solid #e8e4dc', borderRadius:10, fontFamily:"'DM Sans',sans-serif", boxShadow:'0 4px 16px rgba(0,0,0,.08)' }

  return (
    <div>
      <GoalsBanner
        data={data}
        metrics={{ todayIncome, weekIncome, monthIncome, mHotelIncome, mTourismIncome, mHotelExp, mTourismExp, mPersonal, yearNetProfit }}
        onSave={g => save({ ...data, goals: g })}
      />

      {/* Stat cards row 1 */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:12 }}>
        <StatCard icon="💳" label="Баланс"        value={fmt(balance)}    color="#2c5f2e" sub={`Старт: ${fmt(data.startBalance)}`} />
        <StatCard icon="📈" label="Доходи всього" value={fmt(totalIncome)} color="#16a34a" />
        <StatCard icon="📉" label="Витрати бізнесу" value={fmt(totalExpense)} color="#dc2626" />
        <StatCard icon="💰" label="Чистий прибуток" value={fmt(netProfit)} color={netProfit>=0?'#16a34a':'#dc2626'} />
        <StatCard icon="👤" label="Вивів собі"    value={fmt(totalPersonal)} color="#0891b2" sub="частина прибутку" />
      </div>

      {/* Stat cards row 2 */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:24 }}>
        <StatCard icon="📥" label="Дебіторка"  value={fmt(pendingDebt)} color="#ca8a04" sub="очікуємо отримати" alert={overdueDeb>0?`${overdueDeb} прострочено`:null} />
        <StatCard icon="📤" label="Кредиторка" value={fmt(pendingCred)} color="#dc2626"  sub="маємо заплатити"  alert={overdueCred>0?`${overdueCred} прострочено`:null} />
        <StatCard icon="🔄" label="Повернення" value={fmt(pendingRet)}  color="#7c3aed"  sub="очікують оплати" />
        <StatCard icon="🔮" label="Прогноз балансу" value={fmt(balance+pendingDebt-pendingCred-pendingRet)} color="#0891b2" sub="з урахуванням боргів" />
      </div>

      {/* Charts */}
      {chartData.length > 0 ? (
        <>
          <Card style={{ marginBottom: 14 }}>
            <SectionTitle>Готель vs Туризм · динаміка</SectionTitle>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <defs>
                  {[['gh','#2c5f2e'],['gt','#4a7c59'],['ge','#dc2626']].map(([id,c])=>(
                    <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={c} stopOpacity={.15}/>
                      <stop offset="95%" stopColor={c} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8"/>
                <XAxis dataKey="month" stroke="#d1cdc7" fontSize={12}/>
                <YAxis stroke="#d1cdc7" fontSize={12} tickFormatter={v=>(v/1000)+'к'}/>
                <Tooltip formatter={v=>fmt(v)} contentStyle={tooltipStyle}/>
                <Legend wrapperStyle={{ fontFamily:"'DM Sans',sans-serif", fontSize:13 }}/>
                <Area type="monotone" dataKey="hotel"   name="🏨 Готель"  stroke="#2c5f2e" fill="url(#gh)" strokeWidth={2.5}/>
                <Area type="monotone" dataKey="tourism" name="🚌 Туризм"  stroke="#4a7c59" fill="url(#gt)" strokeWidth={2.5}/>
                <Area type="monotone" dataKey="expense" name="Витрати"    stroke="#dc2626" fill="url(#ge)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <Card>
              <SectionTitle>Прибуток по місяцях</SectionTitle>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8"/>
                  <XAxis dataKey="month" stroke="#d1cdc7" fontSize={12}/>
                  <YAxis stroke="#d1cdc7" fontSize={12} tickFormatter={v=>(v/1000)+'к'}/>
                  <Tooltip formatter={v=>fmt(v)} contentStyle={tooltipStyle}/>
                  <Bar dataKey="profit" name="Прибуток" radius={[5,5,0,0]}>
                    {chartData.map((e,i)=><Cell key={i} fill={e.profit>=0?'#2c5f2e':'#dc2626'}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {pieData.length > 0 && (
              <Card>
                <SectionTitle>Розподіл по категоріях</SectionTitle>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={75} innerRadius={32}
                      dataKey="value" label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false}>
                      {pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                    </Pie>
                    <Tooltip formatter={v=>fmt(v)} contentStyle={tooltipStyle}/>
                    <Legend wrapperStyle={{ fontFamily:"'DM Sans',sans-serif", fontSize:12 }}/>
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>
        </>
      ) : (
        <Card style={{ textAlign:'center', padding:56 }}>
          <div style={{ fontSize:44, marginBottom:14 }}>📊</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:'#78716c', marginBottom:8 }}>
            Графіки з'являться після внесення даних
          </div>
          <div style={{ fontSize:13, color:'#b0a898' }}>Перейдіть у «Операції» або «⬆ Імпорт»</div>
        </Card>
      )}
    </div>
  )
}
