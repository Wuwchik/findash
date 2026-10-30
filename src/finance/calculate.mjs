// Independent management calculation. Never mutates the legacy dashboard data.
export const PERIODS = [['day','День'],['week','Тиждень'],['month','Місяць'],['quarter','Квартал'],['year','Рік']]
const DAY = 86400000
export const iso = d => d.toISOString().slice(0,10)
export const date = s => new Date(`${s.slice(0,10)}T00:00:00Z`)
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Kyiv', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date())
export const bankDay = s => s ? new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date(s)) : ''
export function periodRange(kind, asOf) {
  const end = date(asOf), start = date(asOf)
  if (kind === 'week') start.setUTCDate(start.getUTCDate() - (start.getUTCDay()+6)%7)
  if (['month','quarter','year'].includes(kind)) start.setUTCDate(1)
  if (kind === 'quarter') start.setUTCMonth(Math.floor(start.getUTCMonth()/3)*3)
  if (kind === 'year') start.setUTCMonth(0)
  return { start:iso(start), end:iso(end) }
}
const number = x => Number.isFinite(Number(x)) ? Number(x) : 0
const sum = xs => xs.reduce((s,x)=>s+number(x.amount),0)
const inRange = (s,r) => s && s >= r.start && s <= r.end
const round = n => Math.round((n+Number.EPSILON)*100)/100
const days = (a,b) => Math.max(0, Math.round((date(b)-date(a))/DAY)+1)
const later = (a,b) => a>b?a:b
const earlier = (a,b) => a<b?a:b
export function calculate({bank=[], legacy=[], costs=[], refunds=[], links=[], cutoff, range, settings}) {
  const issues=[], detail=[]
  if(settings?.launched_on && range.start < settings.launched_on.slice(0,7)+'-01') issues.push('Історичні витрати до місяця запуску потребують внесення.')
  const byBank = new Map(links.map(x=>[x.bank_id,x]))
  const byCost = new Map(costs.map(x=>[x.id,x]))
  const byRefund = new Map(refunds.map(x=>[x.id,x]))
  const selected = bank.filter(x=>inRange(bankDay(x.date),range))
  const income = sum(selected.filter(x=>x.type==='income'))
  let bankExpense=0, manualExpense=0, recurringExpense=0, refundTotal=0, unreviewed=0, estimated=0
  for (const t of selected.filter(x=>x.type==='expense')) {
    const l=byBank.get(t.id), amount=Math.abs(number(t.amount))
    if (l?.kind==='exclude') continue
    if (l?.kind==='refund' && byRefund.has(l.refund_id)) continue
    if (l?.kind==='cost' && byCost.has(l.cost_id)) continue
    if (l?.kind==='legacy' && legacy.some(x=>String(x.id)===l.legacy_id && x.type==='expense' && x.category!=='personal')) continue
    // Require explicit classification in this new module: avoids treating an existing
    // subscription categorisation as an additional cost before it is reconciled.
    if (l?.kind==='expense') { bankExpense+=amount; detail.push({date:bankDay(t.date),name:t.bank_counterparty||t.description||'Банківська витрата',amount,kind:'Витрата'}); continue }
    if (t.category==='personal' && !l) continue
    unreviewed+=amount
  }
  if (unreviewed) issues.push(`Банківські списання без рішення: ${round(unreviewed).toLocaleString('uk-UA')} грн. Не відняті.`)
  for (const t of legacy.filter(x=>!x.fromBank && !String(x.id).startsWith('bank_') && x.type==='expense' && x.category!=='personal' && inRange(x.date,range))) {
    const amount=Math.abs(number(t.amount)); manualExpense+=amount
    detail.push({date:t.date,name:t.counterparty||t.note||'Ручна витрата',amount,kind:'Раніше внесена витрата'})
  }
  for (const r of refunds) {
    if (r.excluded) continue
    if (!r.entered_on) { issues.push(`Повернення «${r.name}»: потрібно підтвердити дату (${number(r.amount)} грн).`); continue }
    if (r.entered_on < cutoff || !inRange(r.entered_on,range)) continue
    if(r.date_source==='observed') issues.push(`Повернення «${r.name}»: використано дату появи в AURA; підтвердьте дату CRM.`)
    const amount=number(r.amount_override ?? r.amount)
    refundTotal+=amount
    detail.push({date:r.entered_on,name:r.name,amount,kind:'Повернення'})
  }
  for (const c of costs) {
    if (c.start_date>range.end || (c.end_date && c.end_date<range.start)) continue
    const cLinks=links.filter(l=>l.kind==='cost' && l.cost_id===c.id)
    if (c.frequency==='once') {
      if (!inRange(c.start_date,range)) continue
      const actual=sum(bank.filter(b=>cLinks.some(l=>l.bank_id===b.id)))
      const amount=actual || (c.currency==='UAH'?number(c.amount):c.fx_rate?number(c.amount)*number(c.fx_rate):null)
      if (amount===null) { issues.push(`Вкажіть курс або банківську оплату: ${c.name} (${c.amount} ${c.currency}).`); continue }
      manualExpense+=amount; detail.push({date:c.start_date,name:c.name,amount,kind:'Разова витрата'}); continue
    }
    // Monthly allocation, including annual subscriptions amount / 12.
    const m=date(range.start); m.setUTCDate(1)
    while (iso(m)<=range.end) {
      const month=iso(m).slice(0,7), first=iso(m), last=iso(new Date(Date.UTC(m.getUTCFullYear(),m.getUTCMonth()+1,0)))
      const from=later(later(first,range.start),c.start_date), to=earlier(earlier(last,range.end),c.end_date||last)
      const overlap=days(from,to)
      if (overlap) {
        const mapped=bank.filter(b=>cLinks.some(l=>{
          if(l.bank_id!==b.id||!l.coverage_month)return false
          if(c.frequency!=='yearly')return l.coverage_month===`${month}-01`
          const expires=date(l.coverage_month);expires.setUTCMonth(expires.getUTCMonth()+12)
          return first>=l.coverage_month && first<iso(expires)
        }))
        const actual=mapped.length ? sum(mapped)/(c.frequency==='yearly'?12:1) : null
        const converted=c.currency==='UAH'?number(c.amount):c.fx_rate?number(c.amount)*number(c.fx_rate):null
        const base=actual ?? (converted===null?null:converted/(c.frequency==='yearly'?12:1))
        if (base===null) issues.push(`Немає курсу ${c.currency} / оплати: ${c.name}, ${month}.`)
        else {
          const amount=base*overlap/days(first,last); recurringExpense+=amount
          if (actual===null) estimated+=amount
          detail.push({date:from,name:`${c.name} · ${month}`,amount,kind:actual===null?'Регулярна · за тарифом':'Регулярна · за оплатою'})
        }
      }
      m.setUTCMonth(m.getUTCMonth()+1)
    }
  }
  const expenses=bankExpense+manualExpense+recurringExpense
  return {income:round(income),refunds:round(refundTotal),expenses:round(expenses),net:round(income-refundTotal-expenses),unreviewed:round(unreviewed),estimated:round(estimated),issues:[...new Set(issues)],detail:detail.map(x=>({...x,amount:round(x.amount)})),bankExpense:round(bankExpense),manualExpense:round(manualExpense),recurringExpense:round(recurringExpense)}
}
