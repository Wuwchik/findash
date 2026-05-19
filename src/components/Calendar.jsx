import { useState } from 'react'
import { fmt, daysUntil, overdueLabel, Card, SectionTitle } from '../ui.jsx'

export default function Calendar({ data }) {
  const now = new Date()
  const [cal, setCal] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const { year, month } = cal

  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthName = new Intl.DateTimeFormat('uk', { month: 'long', year: 'numeric' }).format(new Date(year, month))
  const todayDay = now.getFullYear() === year && now.getMonth() === month ? now.getDate() : null

  const events = {}
  const addEv = (dateStr, ev) => {
    if (!dateStr) return
    const d = new Date(dateStr)
    if (d.getFullYear() !== year || d.getMonth() !== month) return
    const day = d.getDate()
    if (!events[day]) events[day] = []
    events[day].push(ev)
  }

  data.debtors.filter(d=>!d.paid&&d.due).forEach(d => addEv(d.due, { label:d.name, amount:d.amount, color:'#16a34a', prefix:'+' }))
  data.creditors.filter(c=>!c.paid&&c.due).forEach(c => addEv(c.due, { label:c.name, amount:c.amount, color:'#dc2626', prefix:'-' }))
  data.returns.filter(r=>!r.paid&&r.due).forEach(r => addEv(r.due, { label:r.name, amount:r.amount, color:'#7c3aed', prefix:'-' }))
  data.transactions.forEach(t => {
    const d = new Date(t.date)
    if (d.getFullYear() !== year || d.getMonth() !== month) return
    const day = d.getDate()
    if (!events[day]) events[day] = []
    events[day].push({ label:t.counterparty||'', amount:t.amount, color:t.type==='income'?'#16a34a':'#dc2626', prefix:t.type==='income'?'+':'-', faded:true })
  })

  // Build weeks
  const weeks = []
  let week = { days:[], inflow:0, outflow:0 }
  for (let i=0; i<firstDay; i++) week.days.push(null)
  for (let d=1; d<=daysInMonth; d++) {
    week.days.push(d)
    ;(events[d]||[]).forEach(ev => { if (ev.prefix==='+') week.inflow+=ev.amount; else week.outflow+=ev.amount })
    if (week.days.length===7) { weeks.push(week); week={days:[],inflow:0,outflow:0} }
  }
  while (week.days.length%7!==0) week.days.push(null)
  if (week.days.some(x=>x!==null)) weeks.push(week)

  const upcoming = [
    ...data.debtors.filter(d=>!d.paid&&d.due).map(d=>({...d,color:'#16a34a',icon:'📥',prefix:'+'})),
    ...data.creditors.filter(c=>!c.paid&&c.due).map(c=>({...c,color:'#dc2626',icon:'📤',prefix:'-'})),
    ...data.returns.filter(r=>!r.paid&&r.due).map(r=>({...r,color:'#7c3aed',icon:'🔄',prefix:'-'})),
  ].sort((a,b)=>(a.due||'').localeCompare(b.due||'')).slice(0,12)

  const navBtn = (dir) => ({
    background:'#f5f3ef', border:'1px solid #e8e4dc', borderRadius:8,
    padding:'6px 16px', color:'#78716c', cursor:'pointer', fontSize:18
  })

  return (
    <Card>
      <SectionTitle>Календар платежів</SectionTitle>

      {/* Legend */}
      <div style={{ display:'flex', gap:16, marginBottom:18, flexWrap:'wrap' }}>
        {[['#16a34a','Надходження / дебіторка'],['#dc2626','Виплати / кредиторка'],['#7c3aed','Повернення']].map(([c,l])=>(
          <div key={l} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#78716c' }}>
            <div style={{ width:9, height:9, borderRadius:2, background:c }}/>{l}
          </div>
        ))}
      </div>

      {/* Nav */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <button style={navBtn(-1)} onClick={()=>setCal(p=>{const d=new Date(p.year,p.month-1);return{year:d.getFullYear(),month:d.getMonth()}})}>‹</button>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:700, color:'#1a1a1a', textTransform:'capitalize' }}>{monthName}</div>
        <button style={navBtn(1)}  onClick={()=>setCal(p=>{const d=new Date(p.year,p.month+1);return{year:d.getFullYear(),month:d.getMonth()}})}>›</button>
      </div>

      {/* Weekday headers */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:3 }}>
        {['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].map(d=>(
          <div key={d} style={{ textAlign:'center', fontSize:11, color:'#b0a898', fontWeight:700, padding:'4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((wk,wi)=>(
        <div key={wi}>
          {wk.inflow < wk.outflow && (wk.inflow+wk.outflow>0) && (
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'5px 12px', marginBottom:3, fontSize:11, color:'#dc2626', fontWeight:700 }}>
              ⚠ Касовий розрив: надходить {fmt(wk.inflow)}, виплачується {fmt(wk.outflow)}
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:3 }}>
            {wk.days.map((day,di)=>{
              const isToday = day===todayDay
              const evs = day?(events[day]||[]):[]
              return (
                <div key={di} style={{
                  background: day?(isToday?'#f0fdf4':'#faf9f7'):'transparent',
                  border: isToday?'1.5px solid #16a34a':day?'1px solid #e8e4dc':'none',
                  borderRadius:10, padding:'6px 7px', minHeight:66
                }}>
                  {day && <>
                    <div style={{ fontSize:12, fontWeight:isToday?800:500, color:isToday?'#16a34a':'#b0a898', marginBottom:3 }}>{day}</div>
                    {evs.filter(e=>!e.faded).slice(0,3).map((ev,ei)=>(
                      <div key={ei} style={{ fontSize:10, color:ev.color, background:`${ev.color}15`, borderRadius:4, padding:'2px 5px', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {ev.prefix}{(ev.amount/1000).toFixed(1)}к
                      </div>
                    ))}
                    {evs.filter(e=>!e.faded).length>3 && <div style={{ fontSize:10, color:'#b0a898' }}>+{evs.filter(e=>!e.faded).length-3}</div>}
                  </>}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Upcoming list */}
      <div style={{ marginTop:24 }}>
        <div style={{ fontSize:11, color:'#b0a898', fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', marginBottom:12 }}>Найближчі платежі</div>
        {upcoming.map(item=>{
          const lbl = overdueLabel(item.due)
          return (
            <div key={item.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', background:'#faf9f7', borderRadius:10, marginBottom:6, border:'1px solid #e8e4dc', borderLeft:`3px solid ${item.color}` }}>
              <div style={{ fontSize:18 }}>{item.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>{item.name}</div>
                <div style={{ fontSize:11, color:lbl?.color||'#b0a898', fontWeight:600, marginTop:2 }}>{item.due} · {lbl?.text}</div>
              </div>
              <div style={{ fontWeight:700, color:item.color, fontSize:14 }}>{item.prefix}{fmt(item.amount)}</div>
            </div>
          )
        })}
        {upcoming.length===0 && <div style={{ color:'#b0a898', textAlign:'center', padding:20, fontSize:13 }}>Немає запланованих платежів з датами</div>}
      </div>
    </Card>
  )
}
