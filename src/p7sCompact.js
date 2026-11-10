// Стискає підписаний .p7s (CAdES-X Long з czo.gov.ua, ~17 КБ) до CAdES-BES (~3 КБ):
// прибирає НЕПІДПИСАНІ атрибути (позначки часу, OCSP, копії сертифікатів ЦСК), CRL і зайві сертифікати.
// Сам підпис не змінюється — непідписані атрибути ним не охоплюються.
// Потрібно, бо ДПС відхиляє завеликий заголовок Authorization (nginx: 400 «Request Header Too Large»).
// Чистий JS без залежностей: працює в браузері й у Node (scripts/p7s-to-bes.mjs робить те саме).

function read(buf, pos) {
  const tag = buf[pos]
  let len = buf[pos + 1], hl = 2
  if (len & 0x80) {
    const n = len & 0x7f
    len = 0
    for (let i = 0; i < n; i++) len = len * 256 + buf[pos + 2 + i]
    hl = 2 + n
  }
  const end = pos + hl + len
  if (end > buf.length) throw new Error('пошкоджений файл підпису')
  return { tag, start: pos, body: pos + hl, end }
}
function children(buf, node) {
  const out = []
  for (let p = node.body; p < node.end;) { const c = read(buf, p); out.push(c); p = c.end }
  return out
}
function encLen(n) {
  if (n < 0x80) return [n]
  const bytes = []
  while (n > 0) { bytes.unshift(n & 0xff); n = Math.floor(n / 256) }
  return [0x80 | bytes.length, ...bytes]
}
function concat(parts) {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}
const wrap = (tag, content) => concat([Uint8Array.from([tag, ...encLen(content.length)]), content])

/** DER .p7s → DER CAdES-BES; якщо файл уже компактний — повертає як є */
export function compactP7s(der) {
  const buf = der instanceof Uint8Array ? der : new Uint8Array(der)
  const raw = n => buf.subarray(n.start, n.end)
  const ci = read(buf, 0)
  const [ctype, explicit] = children(buf, ci)
  const sd = read(buf, explicit.body)
  const parts = children(buf, sd)
  const signerSet = parts[parts.length - 1]
  if (signerSet.tag !== 0x31) throw new Error('у файлі немає підпису (signerInfos)')
  const signers = children(buf, signerSet)
  if (signers.length !== 1) throw new Error(`очікувався один підписувач, є ${signers.length}`)
  const siParts = children(buf, signers[0])
  const kept = siParts.filter(p => p.tag !== 0xa1)
  const certSet = parts.find(p => p.tag === 0xa0)
  const extraCerts = certSet ? children(buf, certSet).length > 1 : false
  if (kept.length === siParts.length && !extraCerts && !parts.some(p => p.tag === 0xa1)) return buf
  const newSd = []
  for (const p of parts.slice(0, -1)) {
    if (p.tag === 0xa0) newSd.push(wrap(0xa0, raw(children(buf, p)[0])))
    else if (p.tag !== 0xa1) newSd.push(raw(p))
  }
  newSd.push(wrap(0x31, wrap(0x30, concat(kept.map(raw)))))
  return wrap(0x30, concat([raw(ctype), wrap(0xa0, wrap(0x30, concat(newSd)))]))
}

const toB64 = bytes => {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0))

/** Вміст файлу .p7s (двійковий або Base64-текст) → компактний підпис у Base64 для ДПС */
export function p7sToToken(bytes) {
  // двійковий DER починається з 0x30; Base64-текст — з «MI…» (MII/MIJ/MIK… залежно від довжини)
  const isText = bytes[0] === 0x4d && bytes[1] === 0x49
  const der = isText ? fromB64(new TextDecoder().decode(bytes).replace(/\s+/g, '')) : bytes
  return toB64(compactP7s(der))
}
