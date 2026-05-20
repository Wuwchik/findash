import { useState } from 'react'
import { fmt, todayStr, CATEGORIES, CAT_COLORS, Btn, Input, Select, Modal, SectionTitle } from '../ui.jsx'
import { HOTELS, TECH_VENDORS, MARKETING_VENDORS } from '../counterparties.js'

// Autocomplete input with datalist
function AutoInput({ label, value, onChange, list, placeholder }) {
  const listId = `dl-${label}`
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ fontSize:11, color:'#78716c', marginBottom:5, fontWeight:700, letterSpacing:1, textTransform:'uppercase' }}>{label}</div>}
      <input
        value={value} onChange={onChange} placeholder={placeholder}
        list={listId}
        style={{ width:'100%', background:'#faf9f7', border:'1px solid #e8e4dc', borderRadius:10, padding:'10px 13px', color:'#1a1a1a', fontSize:14, outline:'none', boxSizing:'border-box', fontFamily:"'DM Sans',sans-serif" }}
      />
      <datalist id={listId}>
        {list.map(item => <option key={item} value={item}/>)}
      </datalist>
    </div>
  )
}

function getCounterpartyList(type, category) {
  if (type === 'income') return HOTELS
  if (category === 'tech') return TECH_VENDORS
  if (category === 'marketing') return MARKETING_VENDORS
  return []
}

export default function Transactions({ data, save }) {
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [filter, setFilter] = useState({ type:'all', category:'all', search:'' })

  const addTx = () => {
    if (!form.amount || !form.category || !form.date) return
    save({ ...data, transactions: [...data.transactions, {
      id: Date.now(), type: form.type || 'income',
      category: form.category, amount: parseFloat(form.amount),
      date: form.date, note: form.note || '', counterparty: form.counterparty || ''
    }]})
    setModal(null); setForm({})
  }

  const del = id => save({ ...data, transactions: data.transactions.filter(t => t.id !== id) })
  const filtered = data.transactions.filter(t => {
    if (filter.type !== 'all' && t.type !== filter.type) return false
    if (filter.category !== 'all' && t.category !== filter.category) return false
    if (filter.search && !(t.counterparty||'').toLowerCase().includes(filter.search.toLowerCase())) return false
    return true
  })
  const sorted = [...filtered].sort((a,b) => (b.date||'').localeCompare(a.date||''))
  const allCats = [...CATEGORIES.income, ...CATEGORIES.expense]
  const cpList = getCounterpartyList(form.type, form.category)

  return (
    <div>
      <div style={{ display:'flex', gap:10, marginBottom:22, flexWrap:'wrap' }}>
        <Btn variant="success" onClick={() => { setForm({ type:'income', date:todayStr() }); setModal('tx') }}>+ Дохід</Btn>
        <Btn variant="danger"  onClick={() => { setForm({ type:'expense', date:todayStr() }); setModal('tx') }}>+ Витрата</Btn>
        <Btn variant="cyan"    onClick={() => { setForm({ type:'expense', category:'personal', date:todayStr() }); setModal('tx') }}>👤 Вивів собі</Btn>
        <Btn style={{ background:'#0f766e' }} onClick={() => { setForm({ type:'expense', category:'taxes', date:todayStr() }); setModal('tx') }}>🏛️ Податки</Btn>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <input
          placeholder="🔍 Пошук по контрагенту..."
          value={filter.search}
          onChange={e => setFilter(p=>({...p, search:e.target.value}))}
          style={{ flex:1, minWidth:160, background:'#faf9f7', border:'1px solid #e8e4dc', borderRadius:10, padding:'8px 13px', fontSize:13, outline:'none', fontFamily:"'DM Sans',sans-serif" }}
        />
        <select value={filter.type} onChange={e=>setFilter(p=>({...p,type:e.target.value}))}
          style={{ background:'#faf9f7', border:'1px solid #e8e4dc', borderRadius:10, padding:'8px 13px', fontSize:13, outline:'none', color:'#1a1a1a', fontFamily:"'DM Sans',sans-serif" }}>
          <option value="all">Всі типи</option>
          <option value="income">Тільки доходи</option>
          <option value="expense">Тільки витрати</option>
        </select>
        <select value={filter.category} onChange={e=>setFilter(p=>({...p,category:e.target.value}))}
          style={{ background:'#faf9f7', border:'1px solid #e8e4dc', borderRadius:10, padding:'8px 13px', fontSize:13, outline:'none', color:'#1a1a1a', fontFamily:"'DM Sans',sans-serif" }}>
          <option value="all">Всі категорії</option>
          {[...CATEGORIES.income,...CATEGORIES.expense].map(c=>(
            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
          ))}
        </select>
        {(filter.type!=='all'||filter.category!=='all'||filter.search) && (
          <button onClick={()=>setFilter({type:'all',category:'all',search:''})}
            style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'8px 13px', fontSize:12, color:'#dc2626', cursor:'pointer', fontWeight:600 }}>
            ✕ Скинути
          </button>
        )}
      </div>
      <SectionTitle>Операції ({filtered.length} з {data.transactions.length})</SectionTitle>

      {sorted.map(t => {
        const cat = allCats.find(c => c.id === t.category)
        const isPersonal = t.category === 'personal'
        const isTax = t.category === 'taxes'
        const color = isPersonal ? '#0891b2' : isTax ? '#0f766e' : t.type === 'income' ? '#16a34a' : '#dc2626'
        return (
          <div key={t.id} style={{
            display: 'grid', gridTemplateColumns: '100px 90px 1fr 1fr 130px 28px',
            gap: 8, padding: '11px 16px', background: '#fff', borderRadius: 10, marginBottom: 6,
            alignItems: 'center', borderLeft: `3px solid ${color}`,
            border: '1px solid #e8e4dc', boxShadow: '0 1px 4px rgba(0,0,0,.03)'
          }}>
            <div style={{ fontSize:12, color:'#b0a898' }}>{t.date}</div>
            <div style={{ fontSize:11, color, fontWeight:700 }}>
              {isPersonal ? '👤 Вивід' : isTax ? '🏛️ Податок' : t.type==='income' ? '↑ Дохід' : '↓ Витрата'}
            </div>
            <div style={{ fontSize:12, color:'#78716c' }}>{cat?.icon} {cat?.label || t.category}</div>
            <div style={{ fontSize:12, color:'#b0a898' }}>{t.counterparty || '—'}</div>
            <div style={{ fontSize:14, fontWeight:700, color, textAlign:'right' }}>
              {t.type==='income' ? '+' : '-'}{fmt(t.amount)}
            </div>
            <button onClick={() => del(t.id)} style={{ background:'none', border:'none', color:'#d1cdc7', cursor:'pointer', fontSize:18, lineHeight:1 }}>×</button>
          </div>
        )
      })}

      {data.transactions.length === 0 && (
        <div style={{ textAlign:'center', padding:52, color:'#b0a898', fontSize:14 }}>
          Ще немає операцій. Додайте першу або скористайтесь ⬆ Імпортом
        </div>
      )}

      {modal === 'tx' && (
        <Modal
          title={
            form.category==='personal' ? '👤 Вивід коштів собі' :
            form.category==='taxes'    ? '🏛️ Сплата податків' :
            form.type==='income'       ? '➕ Новий дохід' : '➖ Нова витрата'
          }
          onClose={() => setModal(null)}
        >
          {!['personal','taxes'].includes(form.category) && (
            <Select label="Тип" value={form.type} onChange={e => setForm({...form, type:e.target.value, category:''})}>
              <option value="income">Дохід</option>
              <option value="expense">Витрата</option>
            </Select>
          )}
          {!['personal','taxes'].includes(form.category) && (
            <Select label="Категорія" value={form.category||''} onChange={e => setForm({...form, category:e.target.value})}>
              <option value="">Оберіть...</option>
              {(form.type==='income' ? CATEGORIES.income : CATEGORIES.expense.filter(c=>!['personal','taxes'].includes(c.id))).map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </Select>
          )}

          {form.category === 'personal' && (
            <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:10, padding:'10px 14px', marginBottom:13, fontSize:13, color:'#0891b2' }}>
              💡 Рахується як ваш особистий прибуток, не витрата бізнесу
            </div>
          )}
          {form.category === 'taxes' && (
            <div style={{ background:'#f0fdfa', border:'1px solid #99f6e4', borderRadius:10, padding:'10px 14px', marginBottom:13, fontSize:13, color:'#0f766e' }}>
              🏛️ Квартальні податки: 5% ЄП + 1.5% ВЗ + 1 300 ₴ ЄСВ
            </div>
          )}

          <Input label="Сума (₴)" type="number" value={form.amount||''} onChange={e => setForm({...form, amount:e.target.value})} placeholder="0" />
          <Input label="Дата" type="date" value={form.date||todayStr()} onChange={e => setForm({...form, date:e.target.value})} />

          {!['personal'].includes(form.category) && (
            <AutoInput
              label="Контрагент"
              value={form.counterparty||''}
              onChange={e => setForm({...form, counterparty:e.target.value})}
              list={cpList}
              placeholder={form.type==='income' ? 'Назва готелю...' : 'Постачальник...'}
            />
          )}
          <Input label="Примітка" value={form.note||''} onChange={e => setForm({...form, note:e.target.value})} />

          <div style={{ display:'flex', gap:10, marginTop:14 }}>
            <Btn onClick={addTx} style={{
              background:
                form.category==='personal' ? '#0891b2' :
                form.category==='taxes'    ? '#0f766e' :
                form.type==='income'       ? '#16a34a' : '#dc2626'
            }}>Зберегти</Btn>
            <Btn variant="ghost" onClick={() => setModal(null)}>Скасувати</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
