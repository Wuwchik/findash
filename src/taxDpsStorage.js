// Дані Електронного кабінету ДПС (пише Edge Function tax-dps-sync; тут — лише читання й дії власника)
import { supabase, FUNCTIONS_URL, PUBLIC_ANON_KEY } from './storage'

const must = ({ data, error }) => { if (error) throw error; return data }

export async function loadDps() {
  const [state, accounts, operations, letters, reports] = await Promise.all([
    supabase.from('aura_tax_dps_state').select('*').eq('id', 'main').maybeSingle(),
    supabase.from('aura_tax_dps_accounts').select('*').order('year', { ascending: false }).order('name'),
    supabase.from('aura_tax_dps_operations').select('*').order('op_date', { ascending: false, nullsFirst: false }).limit(300),
    supabase.from('aura_tax_dps_letters').select('*').order('date_in', { ascending: false, nullsFirst: false }).limit(100),
    supabase.from('aura_tax_dps_reports').select('*').order('received_at', { ascending: false, nullsFirst: false }).limit(60),
  ])
  return { state: must(state), accounts: must(accounts), operations: must(operations), letters: must(letters), reports: must(reports) }
}

/** Кількість нових (ще не відкритих в A.U.R.A) листів — для значка на вкладці */
export async function unreadDpsLetters() {
  const { count, error } = await supabase.from('aura_tax_dps_letters').select('id', { count: 'exact', head: true }).is('seen_at', null)
  if (error) return 0
  return count || 0
}

async function call(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('tax-dps-sync', { body: { action, ...payload } })
  if (error) {
    let msg = error.message
    try { msg = (await error.context.json()).error || msg } catch {}
    throw new Error(msg)
  }
  return data
}
export const syncDps = () => call('sync', { force: true })
export const setDpsToken = token => call('set_token', { token })
export const clearDpsToken = () => call('clear_token')

export async function markLetterSeen(id) {
  await supabase.from('aura_tax_dps_letters').update({ seen_at: new Date().toISOString() }).eq('id', id).is('seen_at', null)
}

/** Відкрити PDF листа чи звіту. Вікно відкриваємо одразу по кліку — інакше браузер заблокує */
export async function openDpsFile({ kind, year, altYear, id }) {
  const win = window.open('', '_blank')
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${FUNCTIONS_URL}/tax-dps-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: PUBLIC_ANON_KEY, Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: 'file', kind, year, alt_year: altYear, id }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Помилка ${res.status}`)
    const url = URL.createObjectURL(await res.blob())
    if (win) win.location.href = url
    else window.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 120000)
  } catch (e) {
    win?.close()
    throw e
  }
}
