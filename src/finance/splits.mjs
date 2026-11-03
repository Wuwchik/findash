export const ownIncome = (payment, splits=[]) => Math.round((Number(payment.amount) - Number(splits.find(s=>s.bank_id===payment.id)?.hotel_amount||0))*100)/100
export function hotelDebts(splits=[], payouts=[]) {
 return splits.map(s=>{
  const paid=payouts.filter(p=>p.split_id===s.id).reduce((n,p)=>n+Number(p.amount),0)
  const remaining=Math.round((Number(s.hotel_amount)-paid)*100)/100
  return {...s,paid,remaining,name:`Виплата закладу · ${s.hotel}`,amount:remaining}
 })
}
