import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ownIncome,hotelDebts} from '../src/finance/splits.mjs'
import {calculate} from '../src/finance/calculate.mjs'
const receipt={id:'in',type:'income',amount:15000,date:'2026-11-03T10:00:00Z'}
const split={id:'s',bank_id:'in',hotel:'Hotel',hotel_amount:10000}
const base={bank:[receipt],splits:[split],cutoff:'2026-09-15',range:{start:'2026-11-01',end:'2026-11-30'}}
test('optional split: 15000 gross, 5000 own, 10000 hotel; untouched receipt',()=>{
 assert.equal(ownIncome(receipt),15000)
 assert.equal(ownIncome(receipt,[split]),5000)
 const r=calculate(base)
 assert.equal(r.grossIncome,15000);assert.equal(r.hotelShare,10000);assert.equal(r.net,5000)
 assert.equal(receipt.amount,15000)
})
test('partial and full payouts reduce debt without reducing own income twice',()=>{
 const payments=[{id:'p1',split_id:'s',bank_id:'out1',amount:6000},{id:'p2',split_id:'s',bank_id:'out2',amount:4000}]
 assert.equal(hotelDebts([split],payments.slice(0,1))[0].remaining,4000)
 assert.equal(hotelDebts([split],payments)[0].remaining,0)
 const r=calculate({...base,payouts:payments,bank:[receipt,...payments.map(p=>({id:p.bank_id,type:'expense',amount:p.amount,date:receipt.date}))]})
 assert.equal(r.net,5000);assert.equal(r.expenses,0);assert.equal(r.unreviewed,0)
})
test('later payout does not shift revenue or create an expense in next month',()=>{
 const r=calculate({...base,range:{start:'2026-12-01',end:'2026-12-31'},bank:[receipt,{id:'out',type:'expense',amount:10000,date:'2026-12-01T10:00:00Z'}],payouts:[{split_id:'s',bank_id:'out',amount:10000}]})
 assert.equal(r.net,0);assert.equal(r.unreviewed,0)
})
test('edit/cancel updates same split and restores full own income',()=>{
 assert.equal(calculate({...base,splits:[{...split,hotel_amount:7000}]}).net,8000)
 assert.equal(calculate({...base,splits:[{...split,hotel_amount:0}]}).net,15000)
})
test('operating expenses still reduce own income',()=>{
 const r=calculate({...base,bank:[receipt,{id:'ad',type:'expense',amount:1000,date:receipt.date}],links:[{bank_id:'ad',kind:'expense'}]})
 assert.equal(r.net,4000)
})
