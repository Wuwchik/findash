import { useState } from 'react'
import { fmt, Btn, Input, Modal, SectionTitle, DebtRow } from '../ui.jsx'

export default function Returns({ data, save }) {
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})

  const add = () => {
    if (!form.name || !form.amount) return
    save({ ...data, returns: [...data.returns, { id:Date.now(), name:form.name, amount:parseFloat(form.amount), due:form.due||'', note:form.note||'', paid:false }] })
    setModal(false); setForm({})
  }
  const markPaid = id => save({ ...data, returns: data.returns.map(r => r.id===id ? {...r, paid:true} : r) })
  const del = id => save({ ...data, returns: data.returns.filter(r => r.id!==id) })

  const total = data.returns.filter(r=>!r.paid).reduce((s,r)=>s+r.amount,0)

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22, flexWrap:'wrap', gap:10 }}>
        <Btn variant="purple" onClick={() => { setForm({}); setModal(true) }}>+ Нове повернення</Btn>
        {total > 0 && (
          <div style={{ background:'#faf5ff', border:'1px solid #e9d5ff', borderRadius:10, padding:'8px 16px', fontSize:13, color:'#7c3aed', fontWeight:600 }}>
            Очікує повернень: {fmt(total)}
          </div>
        )}
      </div>

      <SectionTitle>🔄 Повернення клієнтам ({data.returns.length})</SectionTitle>

      {data.returns.map(r => (
        <DebtRow key={r.id} item={r} list="returns" posColor="#7c3aed" prefix="-" payLabel="Повернено"
          onPaid={() => markPaid(r.id)} onDelete={() => del(r.id)} />
      ))}
      {data.returns.length === 0 && <div style={{ color:'#b0a898', fontSize:13 }}>Немає повернень</div>}

      {modal && (
        <Modal title="🔄 Нове повернення клієнту" onClose={() => setModal(false)}>
          <Input label="Клієнт / Готель" value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ксенія / Вудман" />
          <Input label="Сума повернення (₴)" type="number" value={form.amount||''} onChange={e=>setForm({...form,amount:e.target.value})} />
          <Input label="Дата повернення до" type="date" value={form.due||''} onChange={e=>setForm({...form,due:e.target.value})} />
          <Input label="Примітка" value={form.note||''} onChange={e=>setForm({...form,note:e.target.value})} />
          <div style={{ display:'flex', gap:10, marginTop:14 }}>
            <Btn variant="purple" onClick={add}>Зберегти</Btn>
            <Btn variant="ghost" onClick={() => setModal(false)}>Скасувати</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
