import { useEffect, useState } from 'react'
import { loadTaxSettings } from '../taxStorage.js'
import { taxPeriods, quarterIncome, taxEvents, TAX_LABELS, daysUntilDate, formatUAH } from '../taxes.js'
import { bankMatchForEvent } from '../taxPaymentMatch.js'

// Нагадування працюють тільки тоді, коли A.U.R.A відкрита.
// Це Notifications API, а не серверний Web Push для закритого браузера.
const NOTIFY_DAYS = new Set([14, 7, 3, 1, 0, -1, -3, -7])
const todayKey = () => new Date().toLocaleDateString('en-CA')
function sendNotification(title, body, key, onOpenTaxes) {
  try {
    const alert = new window.Notification(title, { body, tag:`aura-tax-${key}` })
    alert.onclick = () => {
      window.focus()
      onOpenTaxes?.()
      alert.close()
    }
    return true
  } catch (e) {
    console.warn('Desktop notifications unavailable', e?.message)
    return false
  }
}

export default function TaxNotificationMonitor({ session, bankTransactions=[], transactions=[], onOpenTaxes }) {
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    if (!session?.user?.id) return
    let active = true
    const load = async () => {
      try {
        const next = await loadTaxSettings(session.user.id)
        if (active) setSettings(next)
      } catch { if (active) setSettings(null) }
    }
    load()
    const timer = setInterval(load, 45000)
    return () => { active = false; clearInterval(timer) }
  }, [session?.user?.id])

  useEffect(() => {
    if (!session?.user?.id || !settings?.notificationsEnabled ||
        typeof window === 'undefined' || !('Notification' in window) ||
        window.Notification.permission !== 'granted') return

    const key = `aura_tax_alerts_v1:${session.user.id}`
    let seen
    try { seen = JSON.parse(localStorage.getItem(key) || '{}') } catch { seen = {} }
    if (!seen || typeof seen !== 'object') seen = {}
    const events = [2026,2027].flatMap(y => taxPeriods(y).flatMap(period => {
      const estimate = quarterIncome(period, bankTransactions, transactions, settings.incomeOverrides || {})
      return taxEvents(period, estimate.source === 'missing' ? null : estimate.amount, settings)
        .map(event => ({period,event}))
    }))
    // На першому запуску не показуємо сповіщення про старі банківські платежі.
    const paymentKeys = []
    for (const {period,event} of events) {
      if (event.kind === 'filing') continue
      const match = bankMatchForEvent(period,event,bankTransactions,settings.bankLinks || {})
      if (match.status === 'paid') paymentKeys.push(`paid:${event.id}`)
    }
    if (!seen.__initialized) {
      paymentKeys.forEach(p => {seen[p] = true})
      seen.__initialized = true
    } else {
      for (const {period,event} of events) {
        if (event.kind === 'filing') continue
        const match = bankMatchForEvent(period,event,bankTransactions,settings.bankLinks || {})
        const notificationKey = `paid:${event.id}`
        if (match.status === 'paid' && !seen[notificationKey]) {
          if (sendNotification('A.U.R.A · Податок оплачено через банк', `${TAX_LABELS[event.kind]} за ${period.quarter} кв. ${period.year}: ${formatUAH(match.amount)}. Підтвердження ДПС ще очікується.`, notificationKey, onOpenTaxes)) {
            seen[notificationKey] = true
          }
        }
      }
    }
    for (const {period,event} of events) {
      if (event.kind === 'esv' && settings.esvExempt) continue
      if (settings.manualStatus?.[event.id]?.done) continue
      if (event.kind !== 'filing' && bankMatchForEvent(period,event,bankTransactions,settings.bankLinks || {}).status === 'paid') continue
      const days = daysUntilDate(event.due)
      if (!NOTIFY_DAYS.has(days)) continue
      const notificationKey = `due:${event.id}:${todayKey()}`
      if (seen[notificationKey]) continue
      const message = days < 0 ? `Строк минув ${Math.abs(days)} дн. тому` :
        days === 0 ? 'Сьогодні останній день' : `До строку залишилось ${days} дн.`
      if (sendNotification('A.U.R.A · Податкове нагадування', `${TAX_LABELS[event.kind]} за ${period.quarter} кв. ${period.year}. ${message} (${event.due}).`, notificationKey, onOpenTaxes)) {
        seen[notificationKey] = true
      }
    }
    // Обмежуємо обсяг localStorage; поточний рік достатній для нагадувань.
    const entries = Object.entries(seen)
    if (entries.length > 500) seen = Object.fromEntries(entries.slice(-300))
    localStorage.setItem(key, JSON.stringify(seen))
  }, [session?.user?.id, settings, bankTransactions, transactions, onOpenTaxes])
  return null
}
