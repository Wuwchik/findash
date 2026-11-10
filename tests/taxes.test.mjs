import assert from 'node:assert/strict'
import test from 'node:test'
import { taxPeriods, quarterIncome, taxEvents, bankPaymentCandidates } from '../src/taxes.js'

const q3 = taxPeriods(2026)[2]

test('2026 Q3 FOP tax deadlines', () => {
  assert.deepEqual(
    { esv:q3.esvDue, filing:q3.filingDue, payment:q3.paymentDue },
    { esv:'2026-10-19', filing:'2026-11-09', payment:'2026-11-19' }
  )
})

test('third-group 5% single tax and 1% military levy forecast', () => {
  const events = taxEvents(q3, 100000, {esvExempt:false})
  assert.equal(events.find(e=>e.kind==='single').amount, 5000)
  assert.equal(events.find(e=>e.kind==='military').amount, 1000)
  assert.equal(events.find(e=>e.kind==='esv').amount, 5707.02)
})

test('unknown taxable income must not be displayed as zero tax', () => {
  const events = taxEvents(q3, null)
  assert.equal(events.find(e=>e.kind==='single').amount, null)
  assert.equal(events.find(e=>e.kind==='military').amount, null)
})

test('bank and ledger must not double count', () => {
  const tx = { type:'income', amount:12500, date:'2026-08-15' }
  assert.deepEqual(quarterIncome(q3,[tx],[tx]), {amount:12500,source:'bank'})
})

test('income override wins over imperfect bank inflows', () => {
  assert.deepEqual(quarterIncome(q3,[],[],{'2026-Q3':37500}), {amount:37500,source:'manual'})
})

test('candidate bank payments are not proof of DPS settlement', () => {
  const bank = [
    { id:'a', type:'expense', amount:500, description:'Єдиний податок', date:'2026-11-15' },
    { id:'b', type:'expense', amount:100, description:'Google Ads', date:'2026-11-15' },
  ]
  assert.deepEqual(bankPaymentCandidates(q3,'single',bank).map(t=>t.id),['a'])
})
