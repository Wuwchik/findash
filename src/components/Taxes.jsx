import { useEffect, useMemo, useState } from 'react'
import { Card, SectionTitle, Btn } from '../ui.jsx'
import { loadTaxSettings, saveTaxSettings } from '../taxStorage.js'
import { DEFAULT_TAX_SETTINGS, TAX_LABELS, taxPeriods, quarterIncome, taxEvents, bankPaymentCandidates, formatUAH, displayDate, daysUntilDate } from '../taxes.js'

const fieldStyle = {
  border: '1px solid #e8e4dc', background: '#faf9f7', borderRadius: 9,
  padding: '8px 10px', fontSize: 13, color: '#1a1a1a', maxWidth: '100%',
}
const note = { fontSize: 12, lineHeight: 1.6, color: '#78716c' }
function Deadline({ date }) {
  const days = daysUntilDate(date)
  const color = days < 0 ? '#b45309' : days < 8 ? '#c2410c' : '#2c5f2e'
  return <span style={{ color, fontWeight: 700, fontSize: 12 }}>
    {days < 0 ? 'Термін минув' : days === 0 ? 'Сьогодні' : 'Через ' + days + ' дн.'}
  </span>
}
export default function Taxes({ session, data, bankTransactions }) {
  const [settings, setSettings] = useState(DEFAULT_TAX_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [incomeDraft, setIncomeDraft] = useState('')
  const [selectedQuarter, setSelectedQuarter] = useState(Math.max(1, Math.min(4, Math.floor(new Date().getMonth()/3))))
  const periods = useMemo(() => taxPeriods(2026), [])
  const period = periods[selectedQuarter - 1]
  const estimate = useMemo(() => quarterIncome(period, bankTransactions, data.transactions || [], settings.incomeOverrides), [period, bankTransactions, data.transactions, settings.incomeOverrides])
  const events = useMemo(() => taxEvents(period, estimate.source === 'missing' ? null : estimate.amount, settings), [period, estimate.amount, settings])
  const statuses = settings.manualStatus || {}
  const esvLabel = settings.esvExempt ? 'Звільнення позначено власником' : 'Перевірити звільнення / фактичну суму'

  useEffect(() => {
    let active = true
    const run = async () => {
      try {
        const saved = await loadTaxSettings(session?.user?.id)
        if (active) {
          setSettings({ ...DEFAULT_TAX_SETTINGS, ...saved, incomeOverrides: saved.incomeOverrides || {}, manualStatus: saved.manualStatus || {} })
          setSaveError('')
        }
      } catch {
        if (active) setSaveError('Не вдалося прочитати податкові налаштування з бази. Зміни поки не зберігатимуться.')
      } finally {
        if (active) setLoaded(true)
      }
    }
    run()
    return () => { active = false }
  }, [session?.user?.id])

  useEffect(() => {
    const manual = settings.incomeOverrides?.[period.key]
    setIncomeDraft(manual === undefined || manual === null ? '' : String(manual))
  }, [settings.incomeOverrides, period.key])

  async function persist(next) {
    setSettings(next)
    try {
      await saveTaxSettings(session?.user?.id, next)
      setSaveError('')
    } catch {
      setSaveError('Зміни не вдалося зберегти у Supabase. Перевірте підключення й повторіть.')
    }
  }
  function updateIncome() {
    const value = incomeDraft.trim().replace(',', '.')
    const nextOverrides = { ...(settings.incomeOverrides || {}) }
    if (value === '') delete nextOverrides[period.key]
    else {
      if (!Number.isFinite(Number(value)) || Number(value) < 0) {
        setSaveError('Сума доходу повинна бути невід’ємним числом.')
        return
      }
      nextOverrides[period.key] = Number(value)
    }
    persist({ ...settings, incomeOverrides: nextOverrides })
  }
  function toggleStatus(item) {
    const current = statuses[item.id]
    const next = { ...statuses }
    if (current?.done) delete next[item.id]
    else next[item.id] = { done: true, source: 'manual', changedAt: new Date().toISOString() }
    persist({ ...settings, manualStatus: next })
  }
  const estimated = events.filter(e => e.kind !== 'filing' && e.amount !== null).reduce((s,e) => s+e.amount,0)
  return <div>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12, marginBottom:20 }}>
      <div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:'#1a1a1a' }}>🏛️ Податки · ФОП</div>
        <div style={note}>Податковий календар · прогноз з банку · контроль оплат</div>
      </div>
      <div style={{ background:'#fef9e7', border:'1px solid #fde68a', color:'#92400e', borderRadius:10, padding:'9px 13px', fontWeight:700, fontSize:12 }}>
        ДПС: ще не підключено
      </div>
    </div>
    <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', color:'#9a3412', padding:'13px 16px', borderRadius:12, marginBottom:16, fontSize:12, lineHeight:1.65 }}>
      ⚠️ Це прогноз A.U.R.A, а не підтверджений податковий борг. Виписка банку не доводить зарахування коштів ДПС.
      Звіряйте дані з розділом «Стан розрахунків з бюджетом» у
      {' '}<a target="_blank" rel="noopener noreferrer" href="https://cabinet.tax.gov.ua/" style={{ color:'#9a3412', fontWeight:700 }}>Електронному кабінеті ДПС</a>.
      Для входу не передавайте A.U.R.A файл КЕП або пароль.
    </div>
    {saveError && <div role="alert" style={{ background:'#fef2f2', padding:12, borderRadius:9, color:'#b91c1c', marginBottom:15, fontSize:12 }}>{saveError}</div>}
    <Card style={{ marginBottom:16 }}>
      <SectionTitle>Податковий режим і період</SectionTitle>
      <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:16 }}>
        <span style={{ fontSize:13, fontWeight:700 }}>ФОП 3 група · 5% без ПДВ · 2026 р.</span>
        <select style={fieldStyle} aria-label="Квартал" value={selectedQuarter} onChange={e => setSelectedQuarter(Number(e.target.value))}>
          {[1,2,3,4].map(q => <option key={q} value={q}>{q} квартал 2026</option>)}
        </select>
      </div>
      <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
        <div style={{ flex:'1 1 210px' }}>
          <div style={note}>Орієнтовні надходження за квартал</div>
          <div style={{ fontSize:22, fontWeight:800, color:'#2c5f2e', margin:'6px 0' }}>{estimate.source === 'missing' ? '—' : formatUAH(estimate.amount)}</div>
          <div style={note}>Джерело: {estimate.source === 'manual' ? 'вручну перевірена сума' : estimate.source === 'bank' ? 'банківські надходження' : estimate.source === 'ledger' ? 'журнал операцій' : 'дані відсутні'}. Надходження ≠ податковий дохід.</div>
        </div>
        <div style={{ flex:'1 1 210px' }}>
          <div style={note}>Орієнтовно ЄП + ВЗ + ЄСВ</div>
          <div style={{ fontSize:22, fontWeight:800, color:'#1a1a1a', margin:'6px 0' }}>{formatUAH(estimated)}</div>
          <div style={note}>Не включає можливі доплати, пеню, переплати. Якщо доходів немає в системі, ЄП та ВЗ не розраховано.</div>
        </div>
      </div>
      <div style={{ marginTop:18, display:'flex', gap:10, flexWrap:'wrap', alignItems:'end' }}>
        <div>
          <label htmlFor="tax-income" style={{...note, display:'block', marginBottom:5}}>Уточнити базу доходу за квартал, грн</label>
          <input id="tax-income" inputMode="decimal" style={fieldStyle} value={incomeDraft} onChange={e => setIncomeDraft(e.target.value)} placeholder="Автоматично з банку" />
        </div>
        <Btn variant="outline" disabled={!loaded} onClick={updateIncome}>Зберегти базу</Btn>
      </div>
      <label style={{...note, display:'flex', alignItems:'center', gap:9, marginTop:18}}>
        <input type="checkbox" disabled={!loaded} checked={!!settings.esvExempt} onChange={e=>persist({ ...settings, esvExempt:e.target.checked })} />
        Є підстава для звільнення від ЄСВ (відмічаю самостійно)
      </label>
      <div style={{...note, marginTop:6}}>{esvLabel}. До підтвердження не вважайте прогноз остаточною сумою до сплати.</div>
    </Card>
    <Card>
      <SectionTitle>Обов’язки за {selectedQuarter} квартал · 2026</SectionTitle>
      {events.map(item => {
        const done = !!statuses[item.id]?.done
        const candidates = bankPaymentCandidates(period, item.kind, bankTransactions)
        return <div key={item.id} style={{ background:'#faf9f7', border:'1px solid #e8e4dc', borderRadius:11, padding:15, marginBottom:10 }}>
          <div style={{ display:'flex', alignItems:'start', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
            <div style={{ flex:'1 1 200px' }}>
              <div style={{fontSize:14,fontWeight:700,color:'#1a1a1a'}}>{TAX_LABELS[item.kind]}</div>
              <div style={{...note, marginTop:3}}>До {displayDate(item.due)} · <Deadline date={item.due}/></div>
              {item.kind === 'filing' && <div style={note}>Подання декларації ≠ оплата податку</div>}
              {!!candidates.length && <div style={{...note, color:'#92400e', marginTop:5}}>🏦 Банк: можливі пов’язані платежі ({candidates.length}). Не підтверджено ДПС.</div>}
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{fontSize:15,fontWeight:700,color:'#1a1a1a'}}>{item.kind === 'filing' ? 'Звітність' : formatUAH(item.amount)}</div>
              <div style={{...note, marginTop:4}}>{done ? '✓ Позначено вручну' : '⚪ Не перевірено'}</div>
              <button disabled={!loaded} onClick={() => toggleStatus(item)}
                style={{ border:'1px solid #cbd5c0', borderRadius:8, background:done?'#fef2f2':'#f0fdf4', color:done?'#991b1b':'#166534', marginTop:7, padding:'7px 10px', cursor:'pointer', fontSize:11, fontWeight:700 }}>
                {done ? 'Скасувати відмітку' : item.kind==='filing' ? 'Я подав декларацію' : 'Я оплатив'}
              </button>
            </div>
          </div>
        </div>
      })}
      <div style={{...note, marginTop:12}}>
        Строки розраховані за загальними правилами і потребують перевірки за податковим календарем ДПС (зокрема переноси та спеціальні правила).
        Ручна позначка означає лише твоє підтвердження, не офіційну звірку ДПС.
      </div>
    </Card>
    <div style={{marginTop:14,...note}}>
      Інтеграція КЕП: технічний етап ще попереду. Офіційний API ДПС вимагає криптографічно підписаний запит.
      <a href="https://cabinet.tax.gov.ua/help/api-registers-int.html" target="_blank" rel="noopener noreferrer" style={{color:'#2c5f2e',marginLeft:5}}>Документація API</a>.
    </div>
  </div>
}
