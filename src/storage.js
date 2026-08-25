import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rgfexlipniijwadwgmxf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnZmV4bGlwbmlpandhZHdnbXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjY0MjgsImV4cCI6MjA5NDg0MjQyOH0.DSsIX_Xao5kH0E_3d6xVZd8NjEqRtGp5GhF0_7u_Lv4'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export function defaultData() {
  return {
    startBalance: 0,
    goals: { day: 6500, week: 52000, month: 215000 },
    transactions: [],
    debtors: [],
    creditors: [],
    returns: []
  }
}

export async function loadData() {
  try {
    const { data: rows, error } = await supabase
      .from('findash_data')
      .select('data')
      .eq('id', 'main')
    if (error) throw error
    if (rows && rows[0] && rows[0].data && Object.keys(rows[0].data).length > 0) {
      return rows[0].data
    }
    return null
  } catch (e) {
    console.error('Load error:', e)
    // fallback to localStorage
    try {
      const raw = localStorage.getItem('findash_v1')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }
}

export async function saveData(data) {
  try {
    const { error } = await supabase
      .from('findash_data')
      .update({ data, updated_at: new Date().toISOString() })
      .eq('id', 'main')
    if (error) throw error
    // also save to localStorage as backup
    localStorage.setItem('findash_v1', JSON.stringify(data))
  } catch (e) {
    console.error('Save error:', e)
    // fallback to localStorage only
    try { localStorage.setItem('findash_v1', JSON.stringify(data)) } catch {}
  }
}

// Завантажити банківські транзакції
export async function loadBankTransactions() {
  try {
    const { data: rows, error } = await supabase
      .from('bank_transactions')
      .select('*')
      .order('date', { ascending: false })
    if (error) throw error
    return Array.isArray(rows) ? rows : []
  } catch (e) {
    console.error('Load bank error:', e)
    return []
  }
}

// Оновити категорію та готель для банківської транзакції
export async function updateBankTransaction(id, updates) {
  try {
    const { error } = await supabase
      .from('bank_transactions')
      .update(updates)
      .eq('id', id)
    if (error) throw error
    return true
  } catch (e) {
    console.error('Update bank error:', e)
    return false
  }
}

// Викликати синхронізацію з ПриватБанком вручну
export async function syncPrivatBank() {
  try {
    const { data, error } = await supabase.functions.invoke('dynamic-handler', {
      method: 'POST'
    })
    if (error) throw error
    return data
  } catch (e) {
    console.error('Sync error:', e)
    return { success: false, error: String(e) }
  }
}
