// Одноразовий імпорт підпису ДПС з комп'ютера власника в A.U.R.A.
//   DPS_IMPORT_KEY=<ключ> node scripts/import-dps-token.mjs "<шлях до файлу з підписом>"
// Файл може містити: підпис у Base64 (MII…) або шлях до підписаного .p7s. Рядки з # ігноруються.
// Підпис не виводиться на екран. Після успіху файл очищується.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const FN = 'https://rgfexlipniijwadwgmxf.supabase.co/functions/v1/tax-dps-sync'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnZmV4bGlwbmlpandhZHdnbXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjY0MjgsImV4cCI6MjA5NDg0MjQyOH0.DSsIX_Xao5kH0E_3d6xVZd8NjEqRtGp5GhF0_7u_Lv4'
const KEY_FILES = /\.(dat|jks|pfx|p12|zs2|pk8|key)$/i

const file = process.argv[2]
const importKey = process.env.DPS_IMPORT_KEY
if (!file || !importKey) { console.error('Потрібно: DPS_IMPORT_KEY і шлях до файлу'); process.exit(2) }

const text = readFileSync(file, 'utf8').split(/\r?\n/).filter(l => !l.trim().startsWith('#')).join('\n').trim()
if (!text) { console.error('Файл порожній: вставте підпис (MII…) або шлях до .p7s'); process.exit(1) }

let token
const maybePath = text.replace(/^"|"$/g, '')
if (!text.startsWith('MII') && existsSync(maybePath)) {
  if (KEY_FILES.test(maybePath)) { console.error('Це файл ключа КЕП — його НЕ потрібно. Потрібен підписаний .p7s.'); process.exit(1) }
  const buf = readFileSync(maybePath)
  token = buf.subarray(0, 3).toString() === 'MII' ? buf.toString('utf8') : buf.toString('base64')
  console.log(`Прочитано підписаний файл (${buf.length} байт)`)
} else {
  token = text
}
token = token.replace(/\s+/g, '')
console.log(`Підпис: ${token.length} символів, починається з ${token.slice(0, 3)}…`)

const res = await fetch(FN, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}`, 'x-import-key': importKey },
  body: JSON.stringify({ action: 'import_token', token }),
})
const body = await res.json().catch(() => ({}))
if (!res.ok) { console.error(`Не підключено: ${body.error || res.status}`); process.exit(1) }

writeFileSync(file, '# ДПС підключено ' + new Date().toLocaleString('uk-UA') + '. Підпис з цього файлу видалено — він зберігається лише у сховищі секретів A.U.R.A.\n')
const { status, operations, newLetters, reports, error } = body
console.log(`ДПС підключено ✓ Стан: ${status}${error ? ` (${error})` : ''}; операцій: ${operations ?? 0}, листів: ${newLetters ?? 0}, звітів: ${reports ?? 0}`)
