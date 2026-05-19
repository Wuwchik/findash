import { useState } from 'react'
import { fmt, Btn, Input, Modal, SectionTitle, DebtRow } from '../ui.jsx'

export default function Debtors({ data, save }) {
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})

  const addDebtor = () => {
    if (!form.name || !form.amount) return
    save({ ...data, debtors: [...data.debtors, { id:Date.now(), name:form.name, amount:parseFloat(form.amount), due:form.due||'', note:form.note||'', paid:false }] })
    setModal(null); setForm({})
  }
  const addCreditor = () => {
    if (!form.name || !form.amount) return
    save({ ...data, creditors: [...data.creditors, { id:Date.now(), name:form.name, amount:parseFloat(form.amount), due:form.due||'', note:form.note||'', paid:false }] })
    setModal(null); setForm({})
  }
  const markPaid = (list, id) => save({ ...data, [list]: data[list].map(i => i.id===id ? {...i, paid:true} : i) })
  const del = (list, id) => save({ ...data, [list]: data[list].filter(i => i.id!==id) })

  const totalDebt = data.debtors.filter(d=>!d.paid).reduce((s,d)=>s+d.amount,0)
  const totalCred = data.creditors.filter(c=>!c.paid).reduce((s,c)=>s+c.amount,0)

  return (
    <div>
      <div style={{ display:'flex', gap:10, marginBottom:22 }}>
        <Btn variant="success" onClick={() => { setForm({}); setModal('debtor') }}>+ Дебіторка</Btn>
        <Btn onClick={() => { setForm({}); setModal('creditor') }}>+ Кредиторка</Btn>
      </div>

      {/* Summary strip */}
      <div style={{ display:'flex', gap:12, marginBottom:24 }}>
        <div style={{ flex:1, background:'#fff', border:'1px solid #e8e4dc', borderRadius:12, padding:'14px 18px', borderLeft:'3px solid #ca8a04' }}>
          <div style={{ fontSize:10, color:'#b0a898', letterSpacing:1.2, textTransform:'uppercase', marginBottom:4 }}>📥 Дебіторка — очікуємо</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:700, color:'#ca8a04' }}>{fmt(totalDebt)}</div>
        </div>
        <div style={{ flex:1, background:'#fff', border:'1px solid #e8e4dc', borderRadius:12, padding:'14px 18px', borderLeft:'3px solid #dc2626' }}>
          <div style={{ fontSize:10, color:'#b0a898', letterSpacing:1.2, textTransform:'uppercase', marginBottom:4 }}>📤 Кредиторка — сплатити</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:700, color:'#dc2626' }}>{fmt(totalCred)}</div>
        </div>
      </div>

      <SectionTitle>📥 Дебіторка — хто винен мені</SectionTitle>
      {data.debtors.map(d => (
        <DebtRow key={d.id} item={d} list="debtors" posColor="#ca8a04" prefix="+" payLabel="Отримано"
          onPaid={() => markPaid('debtors', d.id)} onDelete={() => del('debtors', d.id)} />
      ))}
      {data.debtors.length === 0 && <div style={{ color:'#b0a898', marginBottom:28, fontSize:13 }}>Немає записів</div>}

      <SectionTitle>📤 Кредиторка — кому винен я</SectionTitle>
      {data.creditors.map(c => (
        <DebtRow key={c.id} item={c} list="creditors" posColor="#dc2626" prefix="-" payLabel="Сплачено"
          onPaid={() => markPaid('creditors', c.id)} onDelete={() => del('creditors', c.id)} />
      ))}
      {data.creditors.length === 0 && <div style={{ color:'#b0a898', fontSize:13 }}>Немає записів</div>}

      {modal === 'debtor' && (
        <Modal title="📥 Дебіторка — хто винен мені" onClose={() => setModal(null)}>
          <Input label="Назва / Ім'я" value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Готель Прем'єр" />
          <Input label="Сума (₴)" type="number" value={form.amount||''} onChange={e=>setForm({...form,amount:e.target.value})} />
          <Input label="Очікувана дата оплати" type="date" value={form.due||''} onChange={e=>setForm({...form,due:e.target.value})} />
          <Input label="Примітка" value={form.note||''} onChange={e=>setForm({...form,note:e.target.value})} />
          <div style={{ display:'flex', gap:10, marginTop:14 }}>
            <Btn variant="success" onClick={addDebtor}>Зберегти</Btn>
            <Btn variant="ghost" onClick={() => setModal(null)}>Скасувати</Btn>
          </div>
        </Modal>
      )}
      {modal === 'creditor' && (
        <Modal title="📤 Кредиторка — кому винен я" onClose={() => setModal(null)}>
          <Input label="Назва / Ім'я" value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} />
          <Input label="Сума (₴)" type="number" value={form.amount||''} onChange={e=>setForm({...form,amount:e.target.value})} />
          <Input label="Дата оплати до" type="date" value={form.due||''} onChange={e=>setForm({...form,due:e.target.value})} />
          <Input label="Примітка" value={form.note||''} onChange={e=>setForm({...form,note:e.target.value})} />
          <div style={{ display:'flex', gap:10, marginTop:14 }}>
            <Btn onClick={addCreditor}>Зберегти</Btn>
            <Btn variant="ghost" onClick={() => setModal(null)}>Скасувати</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
