import {saveBankField} from '../finance/store'
import {bankDay} from '../finance/calculate.mjs'
import {SplitButton,SplitDialog} from '../finance/Splits'
import {useFinance} from '../finance/Finance'
import { useState, useMemo, useCallback, memo } from 'react'
import { syncPrivatBank } from '../storage'
import { fmt, CATEGORIES, Card, SectionTitle, Btn } from '../ui.jsx'
import { HOTELS } from '../counterparties.js'

const dateFormatter = new Intl.DateTimeFormat('uk', {day:'numeric',month:'short',year:'numeric'})
const fmtDate = ds => ds ? dateFormatter.format(new Date(ds)) : ''
const EMPTY=[]

export default function Bank({ onImportToMain }) {
  const {state,error,mutate,reload:reloadFinance}=useFinance()
  const txns=state?.bank||EMPTY
  const loading=!state
  const [syncing,setSyncing]=useState(false),[filter,setFilter]=useState('all'),[syncResult,setSyncResult]=useState(null)
  const [search,setSearch]=useState(''),[month,setMonth]=useState(''),[page,setPage]=useState(0),[editing,setEditing]=useState(null)
  const closeEditor=useCallback(()=>setEditing(null),[])
  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    const result = await syncPrivatBank()
    setSyncResult(result)
    await reloadFinance()
    setSyncing(false)
  }

  const setField=useCallback((id,field,value)=>mutate(()=>saveBankField(id,field,value)),[mutate])
  const sorted=useMemo(()=>[...txns].sort((a,b)=>(b.date||'').localeCompare(a.date||'')),[txns])
  const filtered=useMemo(()=>{
    const term=search.trim().toLocaleLowerCase('uk-UA')
    return sorted.filter(t=>{
      if(filter==='uncategorized'&&t.category&&(t.type!=='income'||t.hotel))return false
      if(['income','expense'].includes(filter)&&t.type!==filter)return false
      if(month&&!bankDay(t.date).startsWith(month))return false
      return !term||[t.bank_counterparty,t.description,t.hotel,t.amount,t.id].join(' ').toLocaleLowerCase('uk-UA').includes(term)
    })
  },[sorted,filter,search,month])
  const pageCount=Math.max(1,Math.ceil(filtered.length/50)),activePage=Math.min(page,pageCount-1)
  const visible=useMemo(()=>filtered.slice(activePage*50,activePage*50+50),[filtered,activePage])
  const {uncategorizedCount,totalIncome,totalExpense}=useMemo(()=>({
    uncategorizedCount:txns.filter(t=>!t.category||(t.type==='income'&&!t.hotel)).length,
    totalIncome:txns.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0),
    totalExpense:txns.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0)
  }),[txns])


  if(error&&!state)return <div className="af af-notice">{error}<button onClick={reloadFinance}>Повторити</button></div>
  if (loading) return (
    <Card style={{ textAlign:'center', padding:48 }}>
      <div style={{ fontSize:14, color:'#b0a898' }}>Завантаження банківських транзакцій...</div>
    </Card>
  )

  return (
    <div>
      {/* Header with sync */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:20, fontWeight:700, color:'#1a1a1a' }}>🏦 Банк · ПриватБанк</div>
          <div style={{ fontSize:12, color:'#b0a898', marginTop:2 }}>
            {txns.length} транзакцій · {uncategorizedCount > 0 ? `${uncategorizedCount} без категорії` : 'всі оброблені ✓'}
          </div>
        </div>
        <Btn onClick={handleSync} disabled={syncing} style={{ background: syncing ? '#b0a898' : '#2c5f2e' }}>
          {syncing ? '⏳ Синхронізація...' : '🔄 Оновити з банку'}
        </Btn>
      </div>

      {syncResult && (
        <div style={{ background: syncResult.success ? '#f0fdf4' : '#fef2f2', border:`1px solid ${syncResult.success ? '#86efac' : '#fecaca'}`, borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13, color: syncResult.success ? '#15803d' : '#dc2626' }}>
          {syncResult.success ? `✓ Оновлено. Всього ${syncResult.total}, збережено нових ${syncResult.saved}` : `Помилка: ${syncResult.error}`}
        </div>
      )}

      {/* Summary */}
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:150, background:'#fff', border:'1px solid #e8e4dc', borderRadius:12, padding:'14px 18px', borderLeft:'3px solid #16a34a' }}>
          <div style={{ fontSize:10, color:'#b0a898', letterSpacing:1.2, textTransform:'uppercase', marginBottom:4 }}>Надходження</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:'#16a34a' }}>+{fmt(totalIncome)}</div>
        </div>
        <div style={{ flex:1, minWidth:150, background:'#fff', border:'1px solid #e8e4dc', borderRadius:12, padding:'14px 18px', borderLeft:'3px solid #dc2626' }}>
          <div style={{ fontSize:10, color:'#b0a898', letterSpacing:1.2, textTransform:'uppercase', marginBottom:4 }}>Витрати</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:'#dc2626' }}>-{fmt(totalExpense)}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {[
          ['all', `Всі (${txns.length})`],
          ['uncategorized', `🏷 Без категорії (${uncategorizedCount})`],
          ['income', 'Надходження'],
          ['expense', 'Витрати'],
        ].map(([id, label]) => (
          <button key={id} onClick={() => {setFilter(id);setPage(0)}} style={{
            padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
            fontFamily:"'DM Sans',sans-serif",
            background: filter === id ? '#2c5f2e' : '#f5f3ef',
            color: filter === id ? '#fff' : '#78716c'
          }}>{label}</button>
        ))}
      </div>

      {error&&<div className="af af-notice" role="alert">{error}<button onClick={reloadFinance}>Оновити дані</button></div>}
      <div className="af af-row">
        <input aria-label="Пошук платежу" placeholder="Ім’я, заклад, призначення або сума" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}}/>
        <label>Місяць <input aria-label="Місяць платежів" type="month" value={month} onChange={e=>{setMonth(e.target.value);setPage(0)}}/></label>
        <button onClick={()=>{setMonth('');setSearch('');setFilter('all');setPage(0)}}>Уся історія</button>
      </div>
      <p style={{fontSize:12,color:'#78716c',marginBottom:12}}>Знайдено {filtered.length} платежів. Підсумки зверху — за всією історією.</p>
      <BankRows transactions={visible} setField={setField} onOpen={setEditing}/>
      <div className="af af-row"><button disabled={activePage===0} onClick={()=>setPage(activePage-1)}>Попередні платежі</button><span>Сторінка {activePage+1} з {pageCount} · по 50 платежів</span><button disabled={activePage+1>=pageCount} onClick={()=>setPage(activePage+1)}>Наступні платежі</button></div>
      {editing&&<SplitDialog payment={state.bank.find(b=>b.id===editing.id)||editing} onClose={closeEditor}/>}

      {filtered.length === 0 && (
        <div style={{ textAlign:'center', padding:40, color:'#b0a898', fontSize:14 }}>
          {filter === 'uncategorized' ? 'Всі транзакції оброблені! 🎉' : 'Немає транзакцій'}
        </div>
      )}
    </div>
  )
}

const BankRows=memo(function BankRows({transactions,setField,onOpen}) {
 const expenseCategories=CATEGORIES.expense,incomeCategories=CATEGORIES.income
 return <>      {transactions.map(t => {
        const needsAttention = !t.category || (t.type === 'income' && !t.hotel)
        return (
          <div data-bank-row={t.id} key={t.id} style={{
            background:'#fff', border:'1px solid #e8e4dc', borderRadius:12, padding:'14px 16px', marginBottom:8,
            borderLeft:`3px solid ${t.type === 'income' ? '#16a34a' : '#dc2626'}`,
            boxShadow:'0 1px 4px rgba(0,0,0,.03)'
          }}>
            {/* Top row */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:10, flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {t.bank_counterparty || '—'}
                </div>
                <div style={{ fontSize:11, color:'#b0a898', marginTop:2 }}>
                  {fmtDate(t.date)} · {t.description}
                </div>
              </div>
              <div style={{ fontSize:16, fontWeight:700, color: t.type === 'income' ? '#16a34a' : '#dc2626', whiteSpace:'nowrap' }}>
                {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
              </div>
            </div>

            <SplitButton payment={t} onOpen={onOpen}/>
            {/* Category + Hotel selectors */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              <select
                value={t.category || ''}
                onChange={e => setField(t.id, 'category', e.target.value)}
                style={{
                  background: t.category ? '#f0fdf4' : '#fef9e7',
                  border:`1px solid ${t.category ? '#86efac' : '#fde68a'}`,
                  borderRadius:8, padding:'6px 10px', fontSize:12, outline:'none',
                  color:'#1a1a1a', fontFamily:"'DM Sans',sans-serif", cursor:'pointer'
                }}
              >
                <option value="">🏷 Категорія...</option>
                {(t.type === 'income' ? incomeCategories : expenseCategories).map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                ))}
              </select>

              {t.type === 'income' && (
                <select
                  value={t.hotel || ''}
                  onChange={e => setField(t.id, 'hotel', e.target.value)}
                  style={{
                    background: t.hotel ? '#f0fdf4' : '#fef9e7',
                    border:`1px solid ${t.hotel ? '#86efac' : '#fde68a'}`,
                    borderRadius:8, padding:'6px 10px', fontSize:12, outline:'none',
                    color:'#1a1a1a', fontFamily:"'DM Sans',sans-serif", cursor:'pointer', minWidth:160
                  }}
                >
                  <option value="">🏨 Готель...</option>
                  {HOTELS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              )}

              {needsAttention
                ? <span style={{ fontSize:11, color:'#ca8a04', fontWeight:600 }}>⚠ Потребує уваги</span>
                : <span style={{ fontSize:11, color:'#16a34a', fontWeight:600 }}>✓ Оброблено</span>
              }
            </div>
          </div>
        )
      })}
</>
})
