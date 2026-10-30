// Податкові дані ізольовано від findash_data та фінансового дашборду.
import { supabase } from './storage'

export async function loadTaxSettings(userId) {
  if (!userId) throw new Error('Авторизацію не знайдено')
  const { data, error } = await supabase
    .from('aura_tax_settings')
    .select('tax_regime, esv_exempt, income_overrides, manual_status')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data ? {
    regime: data.tax_regime,
    esvExempt: data.esv_exempt,
    incomeOverrides: data.income_overrides || {},
    manualStatus: data.manual_status || {},
  } : {}
}

export async function saveTaxSettings(userId, settings) {
  if (!userId) throw new Error('Авторизацію не знайдено')
  const { error } = await supabase.from('aura_tax_settings').upsert({
    user_id: userId,
    tax_regime: 'fop3_5',
    esv_exempt: !!settings.esvExempt,
    income_overrides: settings.incomeOverrides || {},
    manual_status: settings.manualStatus || {},
    updated_at: new Date().toISOString(),
  }, { onConflict:'user_id' })
  if (error) throw error
  return true
}
