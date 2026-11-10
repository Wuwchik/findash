import {test} from 'node:test'
import assert from 'node:assert/strict'
import {compactP7s, p7sToToken} from '../src/p7sCompact.js'

// Мінімальна DER-структура CAdES: ContentInfo{OID,[0]{SignedData{ver,digestAlgs,content,[0]certs,[1]crls,{SignerInfo}}}}
const len = n => n < 0x80 ? [n] : n < 0x100 ? [0x81, n] : [0x82, n >> 8, n & 0xff]
const tlv = (tag, ...kids) => { const body = kids.flat(); return [tag, ...len(body.length), ...body] }
const filler = (tag, n) => tlv(tag, Array(n).fill(7))
const signerCore = [tlv(0x02, [1]), filler(0x30, 20), filler(0x30, 10), filler(0xa0, 40), filler(0x30, 12), filler(0x04, 64)]
const build = (withExtras) => {
  const si = tlv(0x30, ...signerCore, ...(withExtras ? [filler(0xa1, 400)] : []))
  const certs = withExtras ? tlv(0xa0, filler(0x30, 50), filler(0x30, 300)) : tlv(0xa0, filler(0x30, 50))
  const sd = tlv(0x30, tlv(0x02, [1]), filler(0x31, 15), filler(0x30, 20), certs, ...(withExtras ? [filler(0xa1, 200)] : []), tlv(0x31, si))
  return Uint8Array.from(tlv(0x30, filler(0x06, 9), tlv(0xa0, sd)))
}

test('compactP7s прибирає непідписані атрибути, CRL і зайві сертифікати', () => {
  const full = build(true), bes = build(false)
  assert.ok(full.length > bes.length + 900)
  assert.deepEqual([...compactP7s(full)], [...bes])
})

test('compactP7s не змінює вже компактний підпис', () => {
  const bes = build(false)
  assert.deepEqual([...compactP7s(bes)], [...bes])
})

test('p7sToToken приймає двійковий файл і Base64-текст однаково', () => {
  const full = build(true)
  const b64text = new TextEncoder().encode(Buffer.from(full).toString('base64'))
  assert.equal(p7sToToken(full), p7sToToken(b64text))
  assert.equal(p7sToToken(full), Buffer.from(build(false)).toString('base64'))
})
