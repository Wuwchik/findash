import React,{useState} from 'react'
import {GitFork} from 'lucide-react'
import {useFinance} from './Finance'
import {saveSplit,linkHotelPayout,unlinkHotelPayout} from './store'
import {hotelDebts,ownIncome} from './splits.mjs'
import {bankDay} from './calculate.mjs'
import {HOTELS} from '../counterparties'
const money=n=>Number(n).toLocaleString('uk-UA',{maximumFractionDigits:2})+' грн'

function SplitForm({payment,split,onClose}) {
 const {mutate,busy,state}=useFinance()
 const [hotel,setHotel]=useState(split?.hotel||payment.hotel||'')
 const [amount,setAmount]=useState(split?.hotel_amount||'')
 const [due,setDue]=useState(split?.due||'')
 const paid=state.payouts.filter(p=>p.split_id===split?.id).reduce((s,p)=>s+Number(p.amount),0)
 const submit=async e=>{
  e.preventDefault()
  if(await mutate(()=>saveSplit({...(split?{id:split.id}:{}),bank_id:payment.id,hotel:hotel.trim(),hotel_amount:Number(amount),due:due||null})))onClose()
 }
 return <form className="af af-form" onSubmit={submit}>
 <h3>Розподіл надходження · {money(payment.amount)}</h3>
 <div className="af-grid"><label className="af-field">Заклад<input required list="aura-split-hotels" value={hotel} disabled={paid>0} onChange={e=>setHotel(e.target.value)}/><datalist id="aura-split-hotels">{HOTELS.map(h=><option key={h} value={h}/>)}</datalist></label>
 <label className="af-field">Частка закладу, грн<input required type="number" min={Math.max(0.01,paid)} max={payment.amount} step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
 <label className="af-field">Строк виплати (необов’язково)<input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label></div>
 <p>Мій дохід: <strong>{money(Number(payment.amount)-Number(amount||0))}</strong>. До виплати закладу: {money(Number(amount||0)-paid)}.</p>
 <p>Банківська сума залишається незмінною. Частка закладу віднімається від доходу за датою надходження. Передача до CRM вимкнена.</p>
 <div className="af-row"><button disabled={busy||!hotel.trim()} type="submit">Зберегти розподіл</button><button type="button" onClick={onClose}>Закрити</button>
 {split&&Number(split.hotel_amount)>0&&<button type="button" disabled={busy||paid>0} title={paid>0?'Спочатку скасуйте прив’язки виплат':''} onClick={async()=>{if(await mutate(()=>saveSplit({...split,hotel_amount:0})))onClose()}}>Скасувати розподіл</button>}</div>
 </form>
}
export function SplitButton({payment}) {
 const {state,error,busy,reload}=useFinance(),[open,setOpen]=useState(false)
 if(payment.type!=='income')return null
 const split=state?.splits.find(s=>s.bank_id===payment.id)
 return <div className="af">{error&&open&&<p role="alert">{error} <button onClick={reload}>Повторити</button></p>}<button type="button" className="af-split-button" disabled={!state||!!error||busy} title="Розподілити платіж" aria-label="Розподілити платіж" onClick={()=>setOpen(!open)}><GitFork size={15}/>{Number(split?.hotel_amount)>0?'Розподілено':'Розподіл'}</button>
 {Number(split?.hotel_amount)>0&&<small> Мій дохід {money(ownIncome(payment,state.splits))} · закладу {money(split.hotel_amount)}</small>}
 {open&&state&&<SplitForm key={split?.updated_at||payment.id} payment={payment} split={split} onClose={()=>setOpen(false)}/>}
 </div>
}
function DebtRow({debt}) {
 const {state,mutate,busy}=useFinance(),[selected,setSelected]=useState(''),[edit,setEdit]=useState(false)
 const payments=state.payouts.filter(p=>p.split_id===debt.id)
 const eligible=state.bank.filter(b=>b.type==='expense'&&Number(b.amount)>0&&Number(b.amount)<=debt.remaining&&!state.payouts.some(p=>p.bank_id===b.id)&&!state.links.some(l=>l.bank_id===b.id)).sort((a,b)=>b.date.localeCompare(a.date))
 const source=state.bank.find(b=>b.id===debt.bank_id)
 return <article className="af-item"><div className="af-row"><strong>{debt.hotel}</strong><strong>{money(debt.remaining)} до виплати</strong></div>
 <p>Частка закладу {money(debt.hotel_amount)} · виплачено {money(debt.paid)} · {Number(debt.hotel_amount)===0?'Розподіл скасовано':debt.remaining===0?'Виплачено':debt.paid>0?'Частково виплачено':'Очікує виплати'}</p>
 <p>Надходження: {source?`${bankDay(source.date)} · ${money(source.amount)} · ${source.bank_counterparty||''}`:debt.bank_id}{debt.due?` · строк виплати ${debt.due}`:' · строк не вказаний'}</p>
 {source&&<button onClick={()=>setEdit(!edit)}>Редагувати розподіл</button>}
 {edit&&source&&<SplitForm key={debt.updated_at} payment={source} split={debt} onClose={()=>setEdit(false)}/>}
 {debt.remaining>0&&<form className="af-row" onSubmit={async e=>{e.preventDefault();if(await mutate(()=>linkHotelPayout(debt.id,selected)))setSelected('')}}>
 <label className="af-field">Фактична виплата з банку<select required value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Оберіть списання</option>{eligible.map(b=><option key={b.id} value={b.id}>{bankDay(b.date)} · {money(b.amount)} · {b.bank_counterparty||b.description}</option>)}</select></label>
 <button disabled={busy||!eligible.some(b=>b.id===selected)}>Зарахувати виплату</button></form>}
 {debt.remaining>0&&<small>Можна прив’язати декілька списань для часткової виплати. Якщо списання вже враховане у «Витратах», спершу скасуйте там його зв’язок. Зарахування не переказує гроші.</small>}
 {payments.map(p=>{const b=state.bank.find(b=>b.id===p.bank_id);return <div className="af-row" key={p.id}><span>{b?bankDay(b.date):''} · виплата {money(p.amount)}</span><button disabled={busy} onClick={()=>mutate(()=>unlinkHotelPayout(p.id))}>Скасувати прив’язку</button></div>})}
 </article>
}
export function HotelDebts() {
 const {state,error,reload}=useFinance(),[showAll,setShowAll]=useState(false)
 if(!state||error)return <div className="af af-notice">{error||'Завантаження виплат закладам…'} <button onClick={reload}>Оновити</button></div>
 const debts=hotelDebts(state.splits,state.payouts),pending=debts.filter(d=>d.remaining>0)
 return <section className="af"><div className="af-row"><h2>Виплати закладам · {money(pending.reduce((n,d)=>n+d.remaining,0))}</h2><button onClick={reload}>Оновити</button></div>
 <p>Заборгованість із розподілених надходжень. Передача до CRM вимкнена. Виплата погашає борг і не зменшує дохід повторно.</p>
 <label><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/> Показати також виплачені та скасовані</label>
 {(showAll?debts:pending).map(d=><DebtRow key={d.id} debt={d}/>)}
 {!pending.length&&!showAll&&<p>Немає невиплачених сум. Розподілити надходження можна кнопкою поруч із платежем у розділі «Банк».</p>}
 </section>
}
