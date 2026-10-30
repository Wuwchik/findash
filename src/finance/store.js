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
  const [settings,costs,refunds,links,bank]=await Promise.all(['aura_finance_settings','aura_finance_costs','aura_finance_refunds','aura_finance_links','bank_transactions'].map(all))
  if(!settings[0]) throw new Error('Модуль фінансів ще не налаштований')
  return {settings:settings[0],costs,refunds,links,bank}
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
