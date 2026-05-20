const SUPABASE_URL = 'https://rgfexlipniijwadwgmxf.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnZmV4bGlwbmlpandhZHdnbXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjY0MjgsImV4cCI6MjA5NDg0MjQyOH0.DSsIX_Xao5kH0E_3d6xVZd8NjEqRtGp5GhF0_7u_Lv4'
const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Prefer': 'return=representation'
}

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
    const res = await fetch(`${SUPABASE_URL}/rest/v1/findash_data?id=eq.main&select=data`, { headers: HEADERS })
    const rows = await res.json()
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
    await fetch(`${SUPABASE_URL}/rest/v1/findash_data?id=eq.main`, {
      method: 'PATCH',
      headers: HEADERS,
      body: JSON.stringify({ data, updated_at: new Date().toISOString() })
    })
    // also save to localStorage as backup
    localStorage.setItem('findash_v1', JSON.stringify(data))
  } catch (e) {
    console.error('Save error:', e)
    // fallback to localStorage only
    try { localStorage.setItem('findash_v1', JSON.stringify(data)) } catch {}
  }
}
