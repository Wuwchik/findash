// Run with AURA_QA_MODULES pointing to a directory containing jsdom.
const path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const {JSDOM}=require(path.join(process.env.AURA_QA_MODULES,'jsdom'));
const esbuild=require('esbuild');
(async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
 global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;global.IS_REACT_ACT_ENVIRONMENT=true;
 const React=require('react'),{createRoot}=require('react-dom/client'),{act,Simulate}=require('react-dom/test-utils');
 const receipt={id:'in',type:'income',amount:15000,date:'2026-11-03T10:00:00Z'};
 global.__finance={settings:{refund_cutoff:'2026-09-15'},costs:[],refunds:[],links:[],splits:[],payouts:[],bank:[receipt,{id:'out',type:'expense',amount:6000,date:receipt.date}]};
 global.__calls=[];global.__loads=0;
 const result=await esbuild.build({stdin:{contents:"export {FinanceProvider,FinanceCard,FinanceReturns} from './src/finance/Finance';export {SplitButton,HotelDebts} from './src/finance/Splits';export {default as Bank} from './src/components/Bank';export {default as Dashboard} from './src/components/Dashboard'",resolveDir:root,loader:'jsx'},write:false,jsx:'automatic',platform:'node',format:'cjs',bundle:true,external:['react','react-dom'],loader:{'.css':'empty'},plugins:[{name:'fixture-store',setup(b){b.onResolve({filter:/\/storage$/},()=>({path:'storage',namespace:'bank-fixture'}));b.onLoad({filter:/.*/,namespace:'bank-fixture'},()=>({contents:'export async function syncPrivatBank(){return {success:true,total:2000,saved:0}}'}));b.onResolve({filter:/\/store$/},()=>({path:'store',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export async function loadFinance(){global.__loads++;return structuredClone(global.__finance)}
 export async function saveSplit(row){if(global.__reject)throw new Error('Test validation rejection');global.__calls.push(['split',row]);global.__finance.splits=[{...row,id:'s',updated_at:String(Date.now())}];return {table:'splits',row:global.__finance.splits[0]}}
 export async function linkHotelPayout(split_id,bank_id){global.__calls.push(['payout',bank_id]);global.__finance.payouts=[{id:'p',split_id,bank_id,amount:6000}];return {table:'payouts',row:global.__finance.payouts[0]}}
 export async function unlinkHotelPayout(id){global.__finance.payouts=[];return {table:'payouts',remove:id}}
 export async function saveFinance(){} export async function removeLink(){} export async function saveBankField(){}` }));}}]});
 const Module=require('module'),m=new Module(path.join(root,'qa.cjs'),module);m.filename=path.join(root,'qa.cjs');m.paths=Module._nodeModulePaths(root);m._compile(result.outputFiles[0].text,m.filename);
 const {FinanceProvider,SplitButton,HotelDebts,FinanceCard,Dashboard,Bank}=m.exports;
 let el;const data={goals:{day:6000,week:42000,month:170000},transactions:[],debtors:[],creditors:[],returns:[],startBalance:0};
 await act(async()=>{el=createRoot(document.getElementById('root'));el.render(React.createElement(FinanceProvider,{legacy:[]},React.createElement(SplitButton,{payment:receipt}),React.createElement(HotelDebts),React.createElement(FinanceCard),React.createElement(Dashboard,{data,save:()=>{},bankTransactions:[receipt]})));await new Promise(r=>setTimeout(r,10))});
 const button=t=>[...document.querySelectorAll('button')].find(b=>b.textContent===t);
 await act(async()=>button('Розподіл').click());
 const form=document.querySelector('form');
 await act(async()=>{Simulate.change(form.querySelector('input[list]'),{target:{value:'Test hotel'}});Simulate.change(form.querySelector('input[type=number]'),{target:{value:'10000'}})});
 await act(async()=>{Simulate.submit(form);await new Promise(r=>setTimeout(r,10))});
 assert.equal(global.__calls[0][1].hotel_amount,10000);assert.match(document.body.textContent,/Мій дохід 5\s?000/);
 await act(async()=>button('Обрати виплату з банку').click());
 const payoutForm=[...document.querySelectorAll('form')].find(f=>f.querySelector('select'));
 await act(async()=>Simulate.change(payoutForm.querySelector('select'),{target:{value:'out'}}));
 await act(async()=>{Simulate.submit(payoutForm);await new Promise(r=>setTimeout(r,10))});
 assert.equal(global.__calls[1][0],'payout');assert.match(document.body.textContent,/4\s?000 грн до виплати/);
 // The main creditor card must include the remaining debt even after a partial payout.
 const card=[...document.querySelectorAll('div')].find(d=>d.textContent==='Кредиторка');
 assert.match(card.parentElement.textContent,/4\s?000/);
 await act(async()=>button('Скасувати прив’язку').click());
 assert.match(document.body.textContent,/10\s?000 грн до виплати/);
 await act(async()=>button('Редагувати розподіл').click());
 await act(async()=>{button('Скасувати розподіл').click();await new Promise(r=>setTimeout(r,10))});
 assert.equal(global.__finance.splits[0].hotel_amount,0);
 assert.equal(global.__loads,1,'writes must not reload financial history');
 console.log('PASS: DOM split submit, own-income display, partial payout, dashboard creditor remaining, unlink, cancellation');
 await act(async()=>el.unmount());
 // Large fixture: the whole history remains searchable but only 50 cards are mounted.
 global.__finance={...global.__finance,splits:[],payouts:[],bank:Array.from({length:2000},(_,i)=>({...receipt,id:'receipt-'+i,bank_counterparty:'Guest '+i}))};
 global.__loads=0;global.__calls=[];
 const started=performance.now();
 await act(async()=>{el=createRoot(document.getElementById('root'));el.render(React.createElement(FinanceProvider,{legacy:[]},React.createElement(Bank)));await new Promise(r=>setTimeout(r,10))});
 assert.equal(document.querySelectorAll('[data-bank-row]').length,50);
 console.log('PERFORMANCE: 2000 receipts, 50 mounted rows; DOM mount '+Math.round(performance.now()-started)+' ms');
 await act(async()=>button('Наступні платежі').click());
 assert.equal(document.querySelector('[data-bank-row]').getAttribute('data-bank-row'),'receipt-50');
 await act(async()=>Simulate.change(document.querySelector('[aria-label="Пошук платежу"]'),{target:{value:'receipt-1999'}}));
 assert.equal(document.querySelectorAll('[data-bank-row]').length,1);
 assert.equal(document.querySelector('[data-bank-row]').getAttribute('data-bank-row'),'receipt-1999');
 await act(async()=>button('Розподіл').click());
 const dialog=document.querySelector('[role="dialog"]');assert.ok(dialog);assert.equal(dialog.parentElement.parentElement,document.body);
 const originalRow=document.querySelector('[data-bank-row]');
 const typed=performance.now();
 await act(async()=>{Simulate.change(dialog.querySelector('input[list]'),{target:{value:'Test hotel'}})});
 for(const value of ['1','10','100','1000','10000'])await act(async()=>Simulate.change(dialog.querySelector('input[type=number]'),{target:{value}}));
 console.log('PERFORMANCE: 5 amount keystrokes '+Math.round(performance.now()-typed)+' ms; no data reloads');
 assert.equal(document.querySelector('[data-bank-row]'),originalRow);
 assert.equal(global.__loads,1);assert.equal(global.__calls.length,0);
 global.__reject=true;
 await act(async()=>Simulate.submit(dialog.querySelector('form')));
 assert.ok(document.querySelector('[role="dialog"]'));assert.match(document.body.textContent,/Test validation rejection/);assert.equal(global.__finance.splits.length,0);
 global.__reject=false;
 await act(async()=>Simulate.submit(dialog.querySelector('form')));
 assert.equal(global.__calls[0][1].bank_id,'receipt-1999');assert.equal(global.__loads,1);
 assert.equal(document.querySelector('[role="dialog"]'),null);
 assert.match(document.body.textContent,/Мій дохід 5\s?000/);
 console.log('PASS: 2000-row pagination, full-history search, isolated portal editor, typing without requests, incremental save');
 await act(async()=>el.unmount());
 dom.window.close();
})().catch(e=>{console.error(e);process.exitCode=1});
