// Чітка прив'язка банківських списань до конкретного податкового зобов'язання.
// Жоден банківський платіж сам по собі не є підтвердженням зарахування ДПС.
import { bankPaymentCandidates } from './taxes.js'

export function quarterFromPurpose(description) {
  const value = String(description || '').toLowerCase()
  const years = [...value.matchAll(/20\d{2}/g)].map(x => Number(x[0]))
  if (!years.length || new Set(years).size !== 1) return null
  const numerals = { 'i':1, 'ii':2, 'iii':3, 'iv':4 }
  const normalized = value.replace(/(?:^|\s)q([1-4])(?=$|\s)/g,' $1 кв ')
  const m = normalized.match(/(?:^|\s)([1-4]|iv|iii|ii|i)\s*(?:[-–]?\s*)?(?:кв(?:артал)?\.?|квартал(?:у|і|а)?)(?=$|[\s.,;:()])/i) ||
    normalized.match(/(?:кв(?:артал)?\.?|квартал(?:у|і|а)?)\s*([1-4]|iv|iii|ii|i)(?:\s|$)/i)
  if (!m) return null
  const quarter = numerals[m[1].toLowerCase()] || Number(m[1])
  return quarter >= 1 && quarter <= 4 ? `${years[0]}-Q${quarter}` : null
}

export function bankMatchForEvent(period, item, bankTransactions=[], bankLinks={}) {
  const candidates = bankPaymentCandidates(period, item.kind, bankTransactions)
  const included = candidates.filter(t => {
    const assigned = bankLinks[String(t.id)]
    if (assigned) return assigned === item.id
    return quarterFromPurpose(t.description || '') === period.key
  })
  const detected = included.filter(t => !bankLinks[String(t.id)])
  const amount = Math.round(included.reduce((s,t)=>s+Number(t.amount || 0),0)*100)/100
  const expected = Number(item.amount)
  const hasExpected = item.amount !== null && item.amount !== undefined && Number.isFinite(expected) && expected > 0
  return {
    included, detected, amount,
    candidates: candidates.filter(t => !included.some(p => String(p.id)===String(t.id)) && !bankLinks[String(t.id)]),
    status: amount <= 0 ? 'unmatched' : hasExpected ? (amount + 0.009 >= expected ? 'paid' : 'partial') : 'amount_unknown'
  }
}
