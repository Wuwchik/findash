import React, {createContext,useContext,useEffect,useState,useCallback} from 'react'
import {loadFinance,saveFinance,removeLink} from './store'
import {calculate,periodRange,PERIODS,today,bankDay} from './calculate.mjs'
import './finance.css'
const Context=createContext(null)
const money=n=>new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH',maximumFractionDigits:2}).format(n)
const categories=[['ai','Штучний інтелект'],['software','Програми / шахматка'],['advertising','Реклама'],['phone','Телефонія'],['domains','Домени'],['hosting','Хостинг'],['hotels','Виплати готелям'],['tax','Податки'],['other','Інше']]
const frequencies={once:'Разова',monthly:'Щомісяця',yearly:'Щороку (розподіл на 12 місяців)'}
export class FinanceBoundary extends React.Component {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed?<div className="af-notice">Новий фінансовий модуль недоступний. Основний дашборд працює окремо. Оновіть сторінку.</div>:this.props.children}
}
export function FinanceProvider({children,legacy}) {
  const [state,setState]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const reload=useCallback(async()=>{try{setError('');setState(await loadFinance())}catch(e){setError(e.message||'Не вдалося завантажити фінанси')}},[])
  useEffect(()=>{reload()},[reload])
  const mutate=async(fn)=>{setBusy(true);try{await fn();await reload();return true}catch(e){setError(e.message||'Не вдалося зберегти');return false}finally{setBusy(false)}}
  return <Context.Provider value={{state,error,busy,reload,mutate,legacy}}>{children}</Context.Provider>
}
function Status(){const {state,error,reload}=useContext(Context);return error?<div className="af-notice" role="alert">Дані нового розрахунку недоступні або не оновлені: {error} <button onClick={reload}>Повторити</button></div>:!state?<div className="af-notice">Завантаження нового розрахунку…</div>:null}
export function FinanceCard(){
 const {state,error,legacy,reload}=useContext(Context),[period,setPeriod]=useState('month'),[asOf,setAsOf]=useState(today()),[expanded,setExpanded]=useState(false)
 if(!state||error) return <Status/>
 const range=periodRange(period,asOf), result=calculate({...state,legacy,cutoff:state.settings.refund_cutoff,range})
 return <section className="af af-summary" aria-label="Окремий розрахунок чистого доходу">
  <div className="af-row"><div><div className="af-eyebrow">ОКРЕМИЙ ФІНАНСОВИЙ РОЗРАХУНОК</div><h2>Чистий дохід</h2></div><button onClick={reload}>Оновити дані</button></div>
  <div className="af-row af-periods">{PERIODS.map(([id,label])=><button key={id} aria-pressed={period===id} className={period===id?'selected':''} onClick={()=>setPeriod(id)}>{label}</button>)}<label>Станом на <input aria-label="Станом на" type="date" value={asOf} max={today()} onChange={e=>e.target.value&&setAsOf(e.target.value)}/></label></div>
  <div className="af-number">{money(result.net)}</div><div>{range.start} — {range.end} · за київським часом</div>
  <div className="af-metrics">{[['Надходження',result.income],['Повернення',-result.refunds],['Витрати',-result.expenses]].map(([name,value])=><div key={name}><span>{name}</span><strong>{money(value)}</strong></div>)}</div>
  <p>Надходження з банку − повернення на етапі CRM − витрати за період. Особисті перекази не є витратами бізнесу.</p>
  {result.estimated>0&&<p>За тарифами нараховано {money(result.estimated)}. Прив’яжіть фактичні оплати у вкладці «Витрати», щоб уточнити суми.</p>}
  {result.issues.length>0&&<div className="af-warning"><strong>Попередній результат — потрібне уточнення ({result.issues.length})</strong><p>Сума ще не враховує всі неперевірені платежі. Додайте також виплати готелям, податки та витрати з інших рахунків, якщо вони є.</p><details><summary>Що потрібно перевірити</summary><ul>{result.issues.map(x=><li key={x}>{x}</li>)}</ul></details></div>}
  <button onClick={()=>setExpanded(!expanded)} aria-expanded={expanded}>Деталізація розрахунку</button>
  {expanded&&<div className="af-table"><table><thead><tr><th>Дата</th><th>Стаття</th><th>Тип</th><th>Віднято</th></tr></thead><tbody>{result.detail.map((r,i)=><tr key={i}><td>{r.date}</td><td>{r.name}</td><td>{r.kind}</td><td>{money(r.amount)}</td></tr>)}</tbody></table></div>}
 </section>
}
function Field({label,children}){return <label className="af-field"><span>{label}</span>{children}</label>}
function CostForm({item,onClose}){
 const {mutate,busy}=useContext(Context)
 const [f,setF]=useState(item||{name:'',category:'other',amount:'',currency:'UAH',fx_rate:'',frequency:'monthly',start_date:today().slice(0,7)+'-01',end_date:''})
 const put=(k,v)=>setF({...f,[k]:v})
 const submit=async(e)=>{e.preventDefault();const row={...(item?{id:item.id}:{}),name:f.name.trim(),category:f.category,amount:Number(f.amount),currency:f.currency,fx_rate:f.currency==='UAH'?null:(f.fx_rate?Number(f.fx_rate):null),frequency:f.frequency,start_date:f.start_date,end_date:f.end_date||null};if(await mutate(()=>saveFinance('costs',row)))onClose()}
 return <form onSubmit={submit} className="af-form"><h3>{item?'Редагування витрати':'Нова витрата'}</h3>
  <div className="af-grid"><Field label="Назва"><input required value={f.name} onChange={e=>put('name',e.target.value)}/></Field><Field label="Категорія"><select value={f.category} onChange={e=>put('category',e.target.value)}>{categories.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
  <Field label="Сума за місяць / рік / разово"><input required type="number" min="0.01" step="0.01" value={f.amount} onChange={e=>put('amount',e.target.value)}/></Field><Field label="Валюта"><select value={f.currency} onChange={e=>put('currency',e.target.value)}>{['UAH','USD','EUR','PLN'].map(x=><option key={x}>{x}</option>)}</select></Field>
  {f.currency!=='UAH'&&<Field label="Плановий курс, грн за 1 одиницю"><input type="number" min="0.000001" step="0.000001" value={f.fx_rate||''} onChange={e=>put('fx_rate',e.target.value)} placeholder="Або прив’яжіть банківську оплату"/></Field>}
  <Field label="Періодичність"><select value={f.frequency} onChange={e=>put('frequency',e.target.value)}>{Object.entries(frequencies).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
  <Field label="Дата початку / разової витрати"><input type="date" required value={f.start_date} onChange={e=>put('start_date',e.target.value)}/></Field><Field label="Останній день нарахування (необов’язково)"><input type="date" min={f.start_date} value={f.end_date||''} onChange={e=>put('end_date',e.target.value)}/></Field></div>
  <p>Місячні витрати розподіляються за днями. Річні — на 12 місяців. Зміна тарифу тут перераховує історію: для нового тарифу завершіть стару витрату й додайте нову.</p>
  <div className="af-row"><button disabled={busy} type="submit">Зберегти</button><button type="button" onClick={onClose}>Скасувати</button></div>
 </form>
}
function RefundRow({r,cutoff}){
 const {mutate,busy}=useContext(Context),[entered,setEntered]=useState(r.entered_on||''),[amount,setAmount]=useState(r.amount_override??r.amount),[excluded,setExcluded]=useState(r.excluded)
 const save=async()=>{await mutate(()=>saveFinance('refunds',{...r,entered_on:entered||null,date_source:entered?'confirmed':'unknown',amount_override:Number(amount),excluded}))}
 return <div className="af-item"><strong>{r.name}</strong><span> · {r.paid?'Повернено':'Очікує виплати'} · {money(r.amount)}</span>
 <div className="af-grid"><Field label="Дата переходу на повернення"><input type="date" max={today()} value={entered} onChange={e=>setEntered(e.target.value)}/></Field><Field label="Сума для нового розрахунку"><input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></Field></div>
 <label><input type="checkbox" checked={excluded} onChange={e=>setExcluded(e.target.checked)}/> Виключити з нового розрахунку</label>
 <p>{!entered?'Дата невідома: не віднімається до підтвердження.':entered<cutoff?'Старе повернення: виключене за фіксованою межею.':r.date_source==='observed'?'Зафіксована дата появи в AURA; за потреби уточніть дату CRM.':'Віднімається один раз за датою переходу, незалежно від статусу виплати.'}</p>
 <button disabled={busy||amount===''||Number(amount)<0} onClick={save}>Зберегти уточнення</button></div>
}
function BankLink({t}){
 const {state,legacy,mutate,busy}=useContext(Context),old=state.links.find(l=>l.bank_id===t.id)
 const [kind,setKind]=useState(old?.kind||''),[target,setTarget]=useState(old?.cost_id||old?.refund_id||old?.legacy_id||''),[month,setMonth]=useState(old?.coverage_month?.slice(0,7)||bankDay(t.date).slice(0,7))
 const targets=kind==='cost'?state.costs:kind==='refund'?state.refunds:legacy.filter(x=>!x.fromBank&&!String(x.id).startsWith('bank_')&&x.type==='expense'&&x.category!=='personal').map(x=>({...x,id:String(x.id),name:x.counterparty||x.note||x.date}))
 const save=()=>mutate(()=>saveFinance('links',{...(old?{id:old.id}:{}),bank_id:t.id,kind,cost_id:kind==='cost'?target:null,refund_id:kind==='refund'?target:null,legacy_id:kind==='legacy'?target:null,coverage_month:kind==='cost'?month+'-01':null}))
 return <div className="af-item"><strong>{money(Number(t.amount))}</strong> · {bankDay(t.date)} · {t.bank_counterparty||'Банківський платіж'}<p>{t.description}</p>
 <div className="af-row"><select aria-label="Як врахувати платіж" value={kind} onChange={e=>{setKind(e.target.value);setTarget('')}}><option value="">Як врахувати?</option><option value="expense">Окрема витрата бізнесу</option><option value="cost">Оплата внесеної витрати / підписки</option><option value="refund">Виплата за поверненням</option><option value="legacy">Вже внесено у старі «Операції»</option><option value="exclude">Особистий / внутрішній переказ — не враховувати</option></select>
 {['cost','refund','legacy'].includes(kind)&&<select aria-label="Пов’язаний запис" value={target} onChange={e=>setTarget(e.target.value)}><option value="">Оберіть запис</option>{targets.map(x=><option key={x.id} value={x.id}>{x.name} · {x.amount} {x.currency||'грн'}</option>)}</select>}
 {kind==='cost'&&<label>Місяць послуги / початку річної оплати <input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>}
 <button disabled={busy||!kind||(['cost','refund','legacy'].includes(kind)&&!target)||(kind==='cost'&&!month)} onClick={save}>Зберегти</button>
 {old&&<button disabled={busy} onClick={()=>mutate(()=>removeLink(old.id))}>Скасувати зв’язок</button>}</div>
 {old&&<small>Врахування збережено. Банківський запис та основні показники не змінені.</small>}</div>
}
function Expenses(){
 const {state}=useContext(Context),[form,setForm]=useState(null),[month,setMonth]=useState(today().slice(0,7)),[page,setPage]=useState(0),[filter,setFilter]=useState('pending')
 const bank=state.bank.filter(t=>t.type==='expense'&&bankDay(t.date).startsWith(month)).filter(t=>filter==='all'||(!state.links.some(l=>l.bank_id===t.id)&&t.category!=='personal')).sort((a,b)=>(b.date||'').localeCompare(a.date||''))
 return <><div className="af-row"><h2>Витрати</h2><button onClick={()=>setForm({})}>+ Додати витрату</button></div>
 <p>Початкові підписки внесені з початку місяця запуску. Вкажіть курс або прив’яжіть фактичну оплату. Рекламу, телефонію, домени, хостинг та інші платежі можна додавати самостійно.</p>
 {form&&<CostForm key={form.id||'new'} item={form.id?form:null} onClose={()=>setForm(null)}/>}
 <div className="af-grid">{state.costs.map(c=><div className="af-item" key={c.id}><strong>{c.name}</strong><h3>{Number(c.amount).toLocaleString('uk-UA')} {c.currency}</h3><p>{frequencies[c.frequency]}<br/>{c.start_date}{c.end_date?` — ${c.end_date}`:''}</p>{c.currency!=='UAH'&&<p>{c.fx_rate?`Плановий курс: ${c.fx_rate}`:'Курс ще не вказаний'}</p>}<button onClick={()=>setForm(c)}>Редагувати</button></div>)}</div>
 <h3>Перевірка банківських списань</h3><p>Кожен платіж враховується один раз. Для підписки прив’яжіть оплату: вона замінить тариф за відповідний період. Для витрати з іншого рахунку достатньо додати разовий запис.</p>
 <div className="af-row"><input aria-label="Місяць банківських списань" type="month" value={month} onChange={e=>{if(e.target.value){setMonth(e.target.value);setPage(0)}}}/><select aria-label="Фільтр списань" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0)}}><option value="pending">Потребують перевірки</option><option value="all">Усі списання</option></select><span>{bank.length} платежів</span></div>
 {bank.slice(page*20,page*20+20).map(t=><BankLink key={t.id+JSON.stringify(state.links.find(l=>l.bank_id===t.id))} t={t}/>)}
 <div className="af-row"><button disabled={page===0} onClick={()=>setPage(page-1)}>Назад</button><span>{page+1} / {Math.max(1,Math.ceil(bank.length/20))}</span><button disabled={(page+1)*20>=bank.length} onClick={()=>setPage(page+1)}>Далі</button></div></>
}
export function FinanceReturns({children}){
 const {state,error,reload}=useContext(Context),[tab,setTab]=useState('returns')
 return <><div className="af af-tabs"><button className={tab==='returns'?'selected':''} onClick={()=>setTab('returns')}>Повернення</button><button className={tab==='expenses'?'selected':''} onClick={()=>setTab('expenses')}>Витрати</button></div>
 {tab==='returns'&&children}
 <FinanceBoundary><div className="af"><Status/>{state&&!error&&(tab==='expenses'?<Expenses/>:<details className="af-item"><summary>Повернення в новому розрахунку чистого доходу ({state.refunds.length})</summary><p>Фіксована межа: {state.settings.refund_cutoff}. Старші повернення не віднімаються. Дата виплати не підміняє дату переходу в CRM.</p><button onClick={reload}>Оновити</button>{state.refunds.map(r=><RefundRow key={r.id+JSON.stringify(r)} r={r} cutoff={state.settings.refund_cutoff}/>)}</details>)}</div></FinanceBoundary></>
}
