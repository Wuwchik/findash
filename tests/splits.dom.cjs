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
 global.__calls=[];
 const result=await esbuild.build({stdin:{contents:"export {FinanceProvider,FinanceCard,FinanceReturns} from './src/finance/Finance';export {SplitButton,HotelDebts} from './src/finance/Splits';export {default as Dashboard} from './src/components/Dashboard'",resolveDir:root,loader:'jsx'},write:false,jsx:'automatic',platform:'node',format:'cjs',bundle:true,external:['react','react-dom'],loader:{'.css':'empty'},plugins:[{name:'fixture-store',setup(b){b.onResolve({filter:/^\.\/store$/},()=>({path:'store',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export async function loadFinance(){return structuredClone(global.__finance)}
 export async function saveSplit(row){global.__calls.push(['split',row]);global.__finance.splits=[{...row,id:'s',updated_at:String(Date.now())}]}
 export async function linkHotelPayout(split_id,bank_id){global.__calls.push(['payout',bank_id]);global.__finance.payouts=[{id:'p',split_id,bank_id,amount:6000}]}
 export async function unlinkHotelPayout(){global.__finance.payouts=[]}
 export async function saveFinance(){} export async function removeLink(){}` }));}}]});
 const Module=require('module'),m=new Module(path.join(root,'qa.cjs'),module);m.filename=path.join(root,'qa.cjs');m.paths=Module._nodeModulePaths(root);m._compile(result.outputFiles[0].text,m.filename);
 const {FinanceProvider,SplitButton,HotelDebts,FinanceCard,Dashboard}=m.exports;
 let el;const data={goals:{day:6000,week:42000,month:170000},transactions:[],debtors:[],creditors:[],returns:[],startBalance:0};
 await act(async()=>{el=createRoot(document.getElementById('root'));el.render(React.createElement(FinanceProvider,{legacy:[]},React.createElement(SplitButton,{payment:receipt}),React.createElement(HotelDebts),React.createElement(FinanceCard),React.createElement(Dashboard,{data,save:()=>{},bankTransactions:[receipt]})));await new Promise(r=>setTimeout(r,10))});
 const button=t=>[...document.querySelectorAll('button')].find(b=>b.textContent===t);
 await act(async()=>button('Розподіл').click());
 const form=document.querySelector('form');
 await act(async()=>{Simulate.change(form.querySelector('input[list]'),{target:{value:'Test hotel'}});Simulate.change(form.querySelector('input[type=number]'),{target:{value:'10000'}})});
 await act(async()=>{Simulate.submit(form);await new Promise(r=>setTimeout(r,10))});
 assert.equal(global.__calls[0][1].hotel_amount,10000);assert.match(document.body.textContent,/Мій дохід 5\s?000/);
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
 console.log('PASS: DOM split submit, own-income display, partial payout, dashboard creditor remaining, unlink, cancellation');
 await act(async()=>el.unmount());
})().catch(e=>{console.error(e);process.exitCode=1});
