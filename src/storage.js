const KEY = 'findash_v1'

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

export function saveData(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
    return true
  } catch { return false }
}

export function defaultData() {
  return {
    startBalance: 29242,
    goals: { day: 6500, week: 52000, month: 215000 },
    transactions: [],
    debtors: [],
    creditors: [],
    returns: []
  }
}
