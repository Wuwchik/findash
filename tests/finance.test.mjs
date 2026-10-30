import {test} from 'node:test'
import assert from 'node:assert/strict'
import {calculate,periodRange,bankDay} from '../src/finance/calculate.mjs'
const input={bank:[],legacy:[],costs:[],refunds:[],links:[],cutoff:'2026-09-15',range:{start:'2026-10-01',end:'2026-10-31'}}
const calc=x=>calculate({...input,...x})
const bank=(id,type,amount,day='2026-10-10')=>({id,type,amount,date:day+'T10:00:00Z'})
const cost=(x={})=>({id:'s',name:'Service',currency:'UAH',amount:3100,start_date:'2026-10-01',frequency:'monthly',...x})
test('calendar periods to selected date; week and quarter boundaries',()=>{
 assert.deepEqual(periodRange('week','2026-11-01'),{start:'2026-10-26',end:'2026-11-01'})
 assert.deepEqual(periodRange('quarter','2026-10-30'),{start:'2026-10-01',end:'2026-10-30'})
 assert.deepEqual(periodRange('year','2026-10-30'),{start:'2026-01-01',end:'2026-10-30'})
 assert.equal(bankDay('2026-10-29T23:30:00Z'),'2026-10-30')
})
test('income includes unclassified bank receipts but no future/out-of-range receipts',()=>{
 assert.equal(calc({bank:[bank('a','income','1000'),bank('b','income',100,'2026-11-01')]}).income,1000)
})
test('refund deducted at transition, not again when paid or linked bank payment',()=>{
 const r={id:'r',name:'Guest',amount:200,entered_on:'2026-10-01'}
 const args={bank:[bank('a','income',1000),bank('b','expense',200)],refunds:[r],links:[{bank_id:'b',kind:'refund',refund_id:'r'}]}
 assert.equal(calc(args).net,800)
 assert.equal(calc({...args,refunds:[{...r,paid:true}]}).net,800)
})
test('fixed legacy cutoff, manual exclusion, missing dates and partial refunds',()=>{
 const result=calc({refunds:[{id:'old',name:'Old',amount:100,entered_on:'2026-09-14'},{id:'unknown',name:'Unknown',amount:200},{id:'excluded',amount:400,entered_on:'2026-10-01',excluded:true},{id:'partial',amount:1000,amount_override:50,entered_on:'2026-10-01'}]})
 assert.equal(result.refunds,50);assert.equal(result.issues.length,1)
 assert.equal(calc({range:{start:'2026-09-01',end:'2026-12-31'},refunds:[{id:'r',amount:100,entered_on:'2026-09-15'}]}).refunds,100)
})
test('monthly prorating sums to monthly price, including leap year and end date',()=>{
 assert.equal(calc({costs:[cost()],range:{start:'2026-10-01',end:'2026-10-15'}}).expenses,1500)
 assert.equal(calc({costs:[cost()],range:{start:'2026-10-16',end:'2026-10-31'}}).expenses,1600)
 assert.equal(calc({costs:[cost({amount:2900,start_date:'2024-02-01'})],range:{start:'2024-02-01',end:'2024-02-29'}}).expenses,2900)
 assert.equal(calc({costs:[cost({end_date:'2026-10-10'})]}).expenses,1000)
})
test('USD not silently zero; entered rate makes tariff visible',()=>{
 const c=cost({currency:'USD',amount:45})
 assert.equal(calc({costs:[c]}).issues.length,1)
 assert.equal(calc({costs:[{...c,fx_rate:40}]}).expenses,1800)
})
test('actual monthly subscription payment replaces estimate and bank expense',()=>{
 const r=calc({costs:[cost({currency:'USD',amount:45})],bank:[bank('b','expense',1900)],links:[{bank_id:'b',kind:'cost',cost_id:'s',coverage_month:'2026-10-01'}]})
 assert.equal(r.expenses,1900);assert.equal(r.estimated,0);assert.equal(r.issues.length,0)
})
test('annual payment allocated to 12 coverage months, never deducted twice',()=>{
 const args={costs:[cost({amount:1200,frequency:'yearly'})],bank:[bank('b','expense',2400)],links:[{bank_id:'b',kind:'cost',cost_id:'s',coverage_month:'2026-10-01'}]}
 assert.equal(calc(args).expenses,200)
 assert.equal(calc({...args,range:{start:'2027-02-01',end:'2027-02-28'}}).expenses,200)
 assert.equal(calc({...args,range:{start:'2026-10-01',end:'2027-09-30'}}).expenses,2400)
})
test('one-off linked expense uses actual UAH',()=>{
 assert.equal(calc({costs:[cost({frequency:'once',currency:'USD',amount:30})],bank:[bank('b','expense',1250)],links:[{bank_id:'b',kind:'cost',cost_id:'s',coverage_month:'2026-10-01'}]}).expenses,1250)
})
test('unclassified outflows flag incomplete totals; personal and transfers excluded',()=>{
 const result=calc({bank:[bank('a','expense',100),{...bank('b','expense',200),category:'personal'},bank('c','expense',300),bank('d','expense',400)],links:[{bank_id:'c',kind:'exclude'},{bank_id:'d',kind:'expense'}]})
 assert.equal(result.expenses,400);assert.equal(result.unreviewed,100)
})
test('legacy manual costs retained, imported bank duplicates excluded',()=>{
 const result=calc({legacy:[{id:1,type:'expense',amount:100,date:'2026-10-01',category:'tech'},{id:'bank_b',type:'expense',amount:100,date:'2026-10-01',fromBank:true}],bank:[bank('b','expense',100)],links:[{bank_id:'b',kind:'legacy',legacy_id:'1'}]})
 assert.equal(result.expenses,100);assert.equal(result.unreviewed,0)
})
test('inputs never mutated by independent calculation',()=>{
 const args={...input,costs:[cost()],bank:[bank('a','income',100)]};const before=JSON.stringify(args)
 calculate(args);assert.equal(JSON.stringify(args),before)
})
