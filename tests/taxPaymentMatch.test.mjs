import assert from 'node:assert/strict'
import test from 'node:test'
import { taxPeriods, taxEvents } from '../src/taxes.js'
import { quarterFromPurpose, bankMatchForEvent } from '../src/taxPaymentMatch.js'

const p = taxPeriods(2026)[2]
const e = taxEvents(p,100000).find(event => event.kind === 'single')
const debit=(id,description,amount=5000)=>({id,type:'expense',date:'2026-11-15',amount,description})

test('explicit Ukrainian or shorthand quarter matches',()=>{
  for (const purpose of ['Сплата єдиного податку за III квартал 2026 року','Єдиний податок за 3 кв 2026','Єдиний податок за Q3 2026'])
    assert.equal(quarterFromPurpose(purpose),'2026-Q3')
  assert.equal(quarterFromPurpose('Єдиний податок за II квартал 2026 року'),'2026-Q2')
  assert.equal(quarterFromPurpose('Єдиний податок за 2026 рік'),null)
})

test('only full amount for the correct quarter earns bank paid status',()=>{
  const rows=[debit('q3','Єдиний податок за III квартал 2026 року'),debit('q2','Єдиний податок за II квартал 2026 року')]
  const result=bankMatchForEvent(p,e,rows)
  assert.equal(result.status,'paid')
  assert.deepEqual(result.included.map(t=>t.id),['q3'])
  assert.equal(result.candidates.length,0)
})

test('partial payment is not marked paid',()=>{
  const result=bankMatchForEvent(p,e,[debit('part','Єдиний податок за III квартал 2026 року',1500)])
  assert.equal(result.status,'partial')
})

test('unlabelled bank debit can be linked to one obligation',()=>{
  const row=debit('unknown','Єдиний податок')
  const before=bankMatchForEvent(p,e,[row])
  assert.equal(before.status,'unmatched')
  assert.deepEqual(before.candidates.map(t=>t.id),['unknown'])
  const after=bankMatchForEvent(p,e,[row],{'unknown':e.id})
  assert.equal(after.status,'paid')
})

test('bank amount is not proof of DPS budget settlement',()=>{
  const result=bankMatchForEvent(p,e,[debit('q3','Єдиний податок за III квартал 2026 року')])
  assert.equal(result.status,'paid')
  assert.equal('dpsVerified' in result,false)
})
