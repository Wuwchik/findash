import { supabase } from '../storage'
async function all(table) {
  const out=[]
  for(let from=0;;from+=1000) {
    const {data,error}=await supabase.from(table).select('*').order('id').range(from,from+999)
    if(error) throw error
    out.push(...data)
    if(data.length<1000) return out
  }
}
export async function loadFinance() {
  const [settings,costs,refunds,links,bank,splits,payouts]=await Promise.all(['aura_finance_settings','aura_finance_costs','aura_finance_refunds','aura_finance_links','bank_transactions','aura_payment_splits','aura_hotel_payouts'].map(all))
  if(!settings[0]) throw new Error('Модуль фінансів ще не налаштований')
  return {settings:settings[0],costs,refunds,links,bank,splits,payouts}
}
export async function saveFinance(table, row) {
  if(!['costs','refunds','links'].includes(table)) throw new Error('Невідомий розділ')
  const query = table === 'refunds'
    ? supabase.from('aura_finance_refunds').update({entered_on:row.entered_on,date_source:row.date_source,amount_override:row.amount_override,excluded:row.excluded}).eq('id',row.id)
    : supabase.from(`aura_finance_${table}`).upsert(row)
  const {error}=await query
  if(error) throw error
}
export async function removeLink(id) {
  const {error}=await supabase.from('aura_finance_links').delete().eq('id',id)
  if(error) throw error
}

export async function saveSplit(row) {
 const payload={...(row.id?{id:row.id}:{}),bank_id:row.bank_id,hotel:row.hotel,hotel_amount:row.hotel_amount,due:row.due||null}
 const {error}=await supabase.from('aura_payment_splits').upsert(payload,{onConflict:'bank_id'})
 if(error)throw error
}
export async function linkHotelPayout(split_id, bank_id) {
 const {error}=await supabase.from('aura_hotel_payouts').insert({split_id,bank_id,amount:0.01})
 if(error)throw error
}
export async function unlinkHotelPayout(id) {
 const {error}=await supabase.from('aura_hotel_payouts').delete().eq('id',id)
 if(error)throw error
}
