// Незалежний модуль прогнозу податкових строків. Не є даними ДПС.
const pad = v => String(v).padStart(2, '0')
const atUTC = (year, monthIndex, day) => new Date(Date.UTC(year, monthIndex, day, 12))
const iso = d => [d.getUTCFullYear(), pad(d.getUTCMonth() + 1), pad(d.getUTCDate())].join('-')
const plusDays = (d, n) => new Date(d.getTime() + n * 86400000)
const followingBusinessDay = input => {
  let day = new Date(input)
  while ([0,6].includes(day.getUTCDay())) day = plusDays(day, 1)
  return day
}
const safeNumber = x => Number.isFinite(Number(x)) ? Number(x) : 0
const datePart = x => String(x || '').slice(0, 10)
export const DEFAULT_TAX_SETTINGS = Object.freeze({
  regime: 'fop3_5',
  esvExempt: false,
  quarterlyIncome: {},
})
export const TAX_LABELS = {
  esv: 'ЄСВ за себе',
  filing: 'Податкова декларація',
  single: 'Єдиний податок 5%',
  military: 'Військовий збір 1%',
}
export function taxPeriods(year) {
  return [1,2,3,4].map(quarter => {
    const start = atUTC(year, 3 * (quarter-1), 1)
    const end = atUTC(year, 3 * quarter, 0)
    const filingNominal = plusDays(end, 40)
    const filing = followingBusinessDay(filingNominal)
    const payment = followingBusinessDay(plusDays(filing, 10))
    // ЄСВ за квартал: граничний день до 20 числа наступного місяця.
    const esv = followingBusinessDay(atUTC(year, 3*quarter, 19))
    return {
      key: `${year}-Q${quarter}`, year, quarter,
      start: iso(start), end: iso(end), filingDue: iso(filing),
      paymentDue: iso(payment), esvDue: iso(esv),
    }
  })
}
export function quarterIncome(period, bankTransactions=[], transactions=[], overrides={}) {
  const manual = overrides?.[period.key]
  if (manual !== undefined && manual !== null && String(manual).trim() !== '' && Number.isFinite(Number(manual)) && Number(manual) >= 0) {
    return { amount: Number(manual), source: 'manual' }
  }
  const bank = bankTransactions.filter(t => t.type === 'income' && datePart(t.date) >= period.start && datePart(t.date) <= period.end)
  // Банківські надходження мають пріоритет, щоб не рахувати дублікати з журналу.
  if (bank.length) return { amount: bank.reduce((a,t)=>a+safeNumber(t.amount),0), source:'bank' }
  const ledger = transactions.filter(t => t.type === 'income' && datePart(t.date) >= period.start && datePart(t.date) <= period.end)
  return { amount: ledger.reduce((a,t)=>a+safeNumber(t.amount),0), source: ledger.length ? 'ledger' : 'missing' }
}
export function taxEvents(period, estimatedIncome, options=DEFAULT_TAX_SETTINGS) {
  const income = Math.max(0,safeNumber(estimatedIncome))
  const esv = options.esvExempt ? 0 : (period.year === 2026 ? 5707.02 : null)
  return [
    { id:`${period.key}:esv`, kind:'esv', due:period.esvDue, amount:esv, quarter:period.key },
    { id:`${period.key}:filing`, kind:'filing', due:period.filingDue, amount:null, quarter:period.key },
    { id:`${period.key}:single`, kind:'single', due:period.paymentDue, amount:Math.round(income * 5)/100, quarter:period.key },
    { id:`${period.key}:military`, kind:'military', due:period.paymentDue, amount:Math.round(income)/100, quarter:period.key },
  ]
}
export const formatUAH = value => value === null || value === undefined ? '—' :
  new Intl.NumberFormat('uk-UA', { style:'currency',currency:'UAH' }).format(value)
export const displayDate = value => {
  const [year,month,day]=value.split('-').map(Number)
  return new Intl.DateTimeFormat('uk-UA',{day:'numeric',month:'long',year:'numeric'}).format(new Date(year,month-1,day))
}
export function daysUntilDate(value, current=new Date()) {
  const [year,month,day]=value.split('-').map(Number)
  const today = Date.UTC(current.getFullYear(),current.getMonth(),current.getDate())
  return Math.round((Date.UTC(year,month-1,day)-today)/86400000)
}
const patterns = {
  esv: /(?:єсв|єдин(?:ий|ого)\s+внес|единый\s+взнос|71040000)/i,
  single: /(?:єдин(?:ий|ого)\s+подат|единый\s+налог|18050400)/i,
  military: /(?:військов(?:ий|ого)\s+збір|военн(?:ый|ого)\s+сбор|11011700)/i,
}
export function bankPaymentCandidates(period, kind, bankTransactions=[]) {
  if (!patterns[kind]) return []
  const from = period.start
  const to = iso(plusDays(atUTC(Number(period.paymentDue.slice(0,4)),Number(period.paymentDue.slice(5,7))-1,Number(period.paymentDue.slice(8,10))),35))
  return bankTransactions.filter(t => t.type === 'expense' && datePart(t.date)>=from && datePart(t.date)<=to &&
    patterns[kind].test([t.description,t.bank_counterparty].join(' '))).sort((a,b)=>String(b.date).localeCompare(String(a.date)))
}
