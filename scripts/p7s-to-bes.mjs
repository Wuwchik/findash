// CAdES-X Long → CAdES-BES: прибирає НЕПІДПИСАНІ атрибути (позначки часу, OCSP, копії сертифікатів ЦСК)
// і зайві сертифікати, лишаючи підпис і сертифікат підписувача. Підпис не змінюється — непідписані атрибути
// ним не охоплюються. Потрібно, бо ДПС відхиляє завеликий заголовок Authorization (400 Bad request).
//   node scripts/p7s-to-bes.mjs <вхід.p7s> <вихід.p7s>
import { readFileSync, writeFileSync } from 'node:fs'

function read(buf, pos) {
  const tag = buf[pos]
  let len = buf[pos + 1], hl = 2
  if (len & 0x80) {
    const n = len & 0x7f
    len = 0
    for (let i = 0; i < n; i++) len = len * 256 + buf[pos + 2 + i]
    hl = 2 + n
  }
  return { tag, hl, len, start: pos, body: pos + hl, end: pos + hl + len }
}
function children(buf, node) {
  const out = []
  for (let p = node.body; p < node.end;) { const c = read(buf, p); out.push(c); p = c.end }
  return out
}
function encLen(n) {
  if (n < 0x80) return Buffer.from([n])
  const bytes = []
  while (n > 0) { bytes.unshift(n & 0xff); n = Math.floor(n / 256) }
  return Buffer.from([0x80 | bytes.length, ...bytes])
}
const wrap = (tag, content) => Buffer.concat([Buffer.from([tag]), encLen(content.length), content])
const raw = (buf, n) => buf.subarray(n.start, n.end)

const [, , input, output] = process.argv
const der = readFileSync(input)
const ci = read(der, 0)                                   // ContentInfo SEQUENCE
const [ctype, explicit] = children(der, ci)               // OID, [0]
const sd = read(der, explicit.body)                       // SignedData SEQUENCE
const parts = children(der, sd)
const signerSet = parts[parts.length - 1]
if (signerSet.tag !== 0x31) throw new Error('signerInfos не знайдено')
const signers = children(der, signerSet)
if (signers.length !== 1) throw new Error(`очікувався один підписувач, є ${signers.length}`)

// SignerInfo: лишаємо все, крім [1] unsignedAttrs (тег 0xA1)
const siParts = children(der, signers[0])
const kept = siParts.filter(p => p.tag !== 0xa1)
const newSigner = wrap(0x30, Buffer.concat(kept.map(p => raw(der, p))))
const removed = siParts.length - kept.length

// certificates [0] (0xA0) усередині SignedData: лишаємо лише перший (підписувача); crls [1] прибираємо
const newSdParts = []
for (const p of parts.slice(0, -1)) {
  if (p.tag === 0xa0) {
    const certs = children(der, p)
    newSdParts.push(wrap(0xa0, raw(der, certs[0])))
  } else if (p.tag === 0xa1) {
    continue
  } else newSdParts.push(raw(der, p))
}
newSdParts.push(wrap(0x31, newSigner))
const newSd = wrap(0x30, Buffer.concat(newSdParts))
const out = wrap(0x30, Buffer.concat([raw(der, ctype), wrap(0xa0, newSd)]))
writeFileSync(output, out)
console.log(`Було ${der.length} байт → стало ${out.length} байт (прибрано непідписаних блоків: ${removed})`)
