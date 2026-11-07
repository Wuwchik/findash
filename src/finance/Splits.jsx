import {createPortal} from 'react-dom'
import React,{useState,useMemo,useEffect,useRef,useId} from 'react'
import {GitFork} from 'lucide-react'
import {useFinance} from './Finance'
import {saveSplit,linkHotelPayout,unlinkHotelPayout} from './store'
import {hotelDebts} from './splits.mjs'
import {bankDay} from './calculate.mjs'
import {HOTELS} from '../counterparties'
const money=n=>Number(n).toLocaleString('uk-UA',{maximumFractionDigits:2})+' грн'

function SplitForm({payment,split,onClose}) {
 const {mutate,busy,error,indexes}=useFinance()
 const hotelListId=useId()
 const [hotel,setHotel]=useState(split?.hotel||payment.hotel||'')
 const [amount,setAmount]=useState(split?.hotel_amount||'')
 const [due,setDue]=useState(split?.due||'')
 const paid=(indexes.payoutsBySplit.get(split?.id)||[]).reduce((s,p)=>s+Number(p.amount),0)
 const submit=async e=>{
  e.preventDefault()
  if(await mutate(()=>saveSplit({...(split?{id:split.id}:{}),bank_id:payment.id,hotel:hotel.trim(),hotel_amount:Number(amount),due:due||null})))onClose()
 }
 return <form className="af af-form" onSubmit={submit}>
 <h3 id="aura-split-title">Розподіл надходження · {money(payment.amount)}</h3>
 {error&&<p role="alert">{error}</p>}
 <fieldset disabled={busy} style={{border:0,padding:0}}><div className="af-grid"><label className="af-field">Заклад<input required list={hotelListId} value={hotel} disabled={paid>0} onChange={e=>setHotel(e.target.value)}/><datalist id={hotelListId}>{HOTELS.map(h=><option key={h} value={h}/>)}</datalist></label>
 <label className="af-field">Частка закладу, грн<input required type="number" min={Math.max(0.01,paid)} max={payment.amount} step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
 <label className="af-field">Строк виплати (необов’язково)<input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label></div></fieldset>
 <p>Мій дохід: <strong>{money(Number(payment.amount)-Number(amount||0))}</strong>. До виплати закладу: {money(Number(amount||0)-paid)}.</p>
 <p>Банківська сума залишається незмінною. Частка закладу віднімається від доходу за датою надходження. Передача до CRM вимкнена.</p>
 <div className="af-row"><button disabled={busy||!hotel.trim()} type="submit">Зберегти розподіл</button><button disabled={busy} type="button" onClick={onClose}>Закрити</button>
 {split&&Number(split.hotel_amount)>0&&<button type="button" disabled={busy||paid>0} title={paid>0?'Спочатку скасуйте прив’язки виплат':''} onClick={async()=>{if(await mutate(()=>saveSplit({...split,hotel_amount:0})))onClose()}}>Скасувати розподіл</button>}</div>
 </form>
}
export function SplitDialog({payment,onClose}) {
 const {indexes,busy}=useFinance(),container=useRef(null),controls=useRef({busy,onClose})
 controls.current={busy,onClose}
 useEffect(()=>{
   const previous=document.activeElement,overflow=document.body.style.overflow
   document.body.style.overflow='hidden'
   container.current?.querySelector('input:not(:disabled),button:not(:disabled)')?.focus()
   const handle=e=>{
     if(e.key==='Escape'&&!controls.current.busy){e.preventDefault();controls.current.onClose()}
     if(e.key==='Tab'){
       const items=[...container.current.querySelectorAll('input:not(:disabled),select:not(:disabled),button:not(:disabled)')]
       if(!items.length){e.preventDefault();return}
       const first=items[0],last=items[items.length-1]
       if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
       else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
     }
   }
   document.addEventListener('keydown',handle)
   return()=>{document.removeEventListener('keydown',handle);document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus()}
 },[])
 const split=indexes.splitByBank.get(payment.id)
 return createPortal(<div className="af-modal-backdrop"><div ref={container} className="af-modal" role="dialog" aria-modal="true" aria-labelledby="aura-split-title"><SplitForm key={payment.id} payment={payment} split={split} onClose={onClose}/></div></div>,document.body)
}
export function SplitButton({payment,onOpen}) {
 const {state,error,busy,indexes}=useFinance(),[open,setOpen]=useState(false)
 if(payment.type!=='income')return null
 const split=indexes.splitByBank.get(payment.id)
 return <div className="af"><button type="button" className="af-split-button" disabled={!state||!!error||busy} title="Розподілити платіж" aria-label="Розподілити платіж" onClick={()=>onOpen?onOpen(payment):setOpen(true)}><GitFork size={15}/>{Number(split?.hotel_amount)>0?'Розподілено':'Розподіл'}</button>
 {Number(split?.hotel_amount)>0&&<small> Мій дохід {money(Number(payment.amount)-Number(split.hotel_amount))} · закладу {money(split.hotel_amount)}</small>}
 {open&&state&&<SplitDialog payment={payment} onClose={()=>setOpen(false)}/>}
 </div>
}
function PayoutPicker({debt,onClose}) {
 const {state,indexes,mutate,busy}=useFinance()
 const [selected,setSelected]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(0)
 const eligible=useMemo(()=>{
   const term=search.trim().toLocaleLowerCase('uk-UA')
   return state.bank.filter(b=>b.type==='expense'&&Number(b.amount)>0&&Number(b.amount)<=debt.remaining&&!indexes.usedBank.has(b.id)&&(!term||[b.bank_counterparty,b.description,b.amount,b.date,b.id].join(' ').toLocaleLowerCase('uk-UA').includes(term))).sort((a,b)=>(b.date||'').localeCompare(a.date||''))
 },[state.bank,indexes.usedBank,debt.remaining,search])
 const pages=Math.max(1,Math.ceil(eligible.length/50)),activePage=Math.min(page,pages-1)
 return <form className="af-item" onSubmit={async e=>{e.preventDefault();if(await mutate(()=>linkHotelPayout(debt.id,selected)))onClose()}}>
 <label className="af-field">Пошук списання<input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);setSelected('')}} placeholder="Отримувач, дата, сума або призначення"/></label>
 <label className="af-field">Фактична виплата з банку<select required value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Оберіть списання</option>{eligible.slice(activePage*50,activePage*50+50).map(b=><option key={b.id} value={b.id}>{bankDay(b.date)} · {money(b.amount)} · {b.bank_counterparty||b.description}</option>)}</select></label>
 <div className="af-row"><button type="button" disabled={activePage===0} onClick={()=>{setPage(activePage-1);setSelected('')}}>Назад</button><span>{eligible.length} списань · сторінка {activePage+1}/{pages}</span><button type="button" disabled={activePage+1>=pages} onClick={()=>{setPage(activePage+1);setSelected('')}}>Далі</button></div>
 <div className="af-row"><button disabled={busy||!eligible.some(b=>b.id===selected)}>Зарахувати виплату</button><button type="button" disabled={busy} onClick={onClose}>Закрити вибір списання</button></div>
 </form>
}
function DebtRow({debt}) {
 const {indexes,mutate,busy}=useFinance(),[edit,setEdit]=useState(false),[choosing,setChoosing]=useState(false)
 const payments=indexes.payoutsBySplit.get(debt.id)||[]
 const source=indexes.byBank.get(debt.bank_id)
 return <article className="af-item"><div className="af-row"><strong>{debt.hotel}</strong><strong>{money(debt.remaining)} до виплати</strong></div>
 <p>Частка закладу {money(debt.hotel_amount)} · виплачено {money(debt.paid)} · {Number(debt.hotel_amount)===0?'Розподіл скасовано':debt.remaining===0?'Виплачено':debt.paid>0?'Частково виплачено':'Очікує виплати'}</p>
 <p>Надходження: {source?`${bankDay(source.date)} · ${money(source.amount)} · ${source.bank_counterparty||''}`:debt.bank_id}{debt.due?` · строк виплати ${debt.due}`:' · строк не вказаний'}</p>
 {source&&<button onClick={()=>setEdit(!edit)}>Редагувати розподіл</button>}
 {edit&&source&&<SplitDialog payment={source} onClose={()=>setEdit(false)}/>}
 {debt.remaining>0&&(choosing?<PayoutPicker debt={debt} onClose={()=>setChoosing(false)}/>:<button onClick={()=>setChoosing(true)}>Обрати виплату з банку</button>)}
 {debt.remaining>0&&<small>Можна прив’язати декілька списань для часткової виплати. Якщо списання вже враховане у «Витратах», спершу скасуйте там його зв’язок. Зарахування не переказує гроші.</small>}
 {payments.map(p=>{const b=indexes.byBank.get(p.bank_id);return <div className="af-row" key={p.id}><span>{b?bankDay(b.date):''} · виплата {money(p.amount)}</span><button disabled={busy} onClick={()=>mutate(()=>unlinkHotelPayout(p.id))}>Скасувати прив’язку</button></div>})}
 </article>
}
export function HotelDebts() {
 const {state,error,reload}=useFinance(),[showAll,setShowAll]=useState(false),[page,setPage]=useState(0)
 const debts=useMemo(()=>hotelDebts(state?.splits||[],state?.payouts||[]),[state?.splits,state?.payouts])
 const pending=useMemo(()=>debts.filter(d=>d.remaining>0),[debts])
 const shown=showAll?debts:pending,pages=Math.max(1,Math.ceil(shown.length/50)),activePage=Math.min(page,pages-1)
 if(!state||error)return <div className="af af-notice">{error||'Завантаження виплат закладам…'} <button onClick={reload}>Оновити</button></div>
 return <section className="af"><div className="af-row"><h2>Виплати закладам · {money(pending.reduce((n,d)=>n+d.remaining,0))}</h2><button onClick={reload}>Оновити</button></div>
 <p>Заборгованість із розподілених надходжень. Передача до CRM вимкнена. Виплата погашає борг і не зменшує дохід повторно.</p>
 <label><input type="checkbox" checked={showAll} onChange={e=>{setShowAll(e.target.checked);setPage(0)}}/> Показати також виплачені та скасовані</label>
 {shown.slice(activePage*50,activePage*50+50).map(d=><DebtRow key={d.id} debt={d}/>)}
 <div className="af-row"><button disabled={activePage===0} onClick={()=>setPage(activePage-1)}>Попередні борги</button><span>{activePage+1}/{pages}</span><button disabled={activePage+1>=pages} onClick={()=>setPage(activePage+1)}>Наступні борги</button></div>
 {!pending.length&&!showAll&&<p>Немає невиплачених сум. Розподілити надходження можна кнопкою поруч із платежем у розділі «Банк».</p>}
 </section>
}
