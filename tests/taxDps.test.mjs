import test from 'node:test'
import assert from 'node:assert/strict'
import * as L from '../supabase/functions/tax-dps-sync/logic.ts'

// Приклади відповідей — з документації API приватної частини ЕК ДПС
const splatp = [{ idpmnt:'01200BEEDAA5032AE0530A214206197B', yearoper:2019, cSti:2659, nameSti:'ГУ ДПС У М.КИЄВІ', facemode:1,
  tinS:'34554355', payerName:'ФОП Тест', plat1:'30 11011000 00', budgetTin:37995466, budgetPayerName:'УДКСУ',
  budgetMfo:899998, budgetBankName:'Казначейство України(ел. адм. подат.)', budgetAccount:31115063026011,
  budgetAccountIban:'UA058999980000031115063026011', namePlt:'ВIЙСЬКОВИЙ ЗБIР', narah0:0, splbd0:131.21, povbd0:0,
  penia0:0, nedoim0:0, perepl0:0, sldpn0:0, debtAll:0 }]

test('Київський час → ISO з літнім і зимовим зсувом', () => {
  assert.equal(L.kyivToIso('2021-05-05 16:11:32'), '2021-05-05T13:11:32.000Z')
  assert.equal(L.kyivToIso('2021-12-05 16:11:32'), '2021-12-05T14:11:32.000Z')
  assert.equal(L.kyivToIso(null), null)
  assert.equal(L.dmyToIso('05.12.2019'), '2019-12-05')
})

test('стан розрахунків: суми, код бюджету, реквізити для сплати', () => {
  const [a] = L.mapAccounts(splatp, 2019)
  assert.equal(a.id, '2019:01200BEEDAA5032AE0530A214206197B')
  assert.equal(a.budget_code, '11011000')
  assert.equal(a.paid, 131.21)
  assert.equal(a.iban, 'UA058999980000031115063026011')
  assert.equal(a.recipient_code, '37995466')
  assert.equal(L.payerNameOf(splatp), 'ФОП Тест')
  assert.deepEqual(L.mapAccounts(null, 2019), [])
})

test('операції: рядок «Всього» пропускаємо, дата й коментар зберігаються', () => {
  const body = { content: [
    { rn:299912000000, dateoper:null, vidpa:'Всього', splpov0:131233.21 },
    { rn:201912000025, dateoper:'05.12.2019', vidpa:'101', namevid:'Сплата суми податкiв', isnull0:106.36, splpov0:106.36, templ:'Зараховано 05.12.2019' },
  ] }
  const ops = L.mapOperations(body, 'acc')
  assert.equal(ops.length, 1)
  assert.deepEqual([ops[0].id, ops[0].op_date, ops[0].amount, ops[0].comment], ['acc:201912000025', '2019-12-05', 106.36, 'Зараховано 05.12.2019'])
})

test('зміни рахунку: нові суми → перечитати операції', () => {
  const [a] = L.mapAccounts(splatp, 2019)
  assert.equal(L.accountChanged(undefined, a), true)
  assert.equal(L.accountChanged({ ...a }, a), false)
  assert.equal(L.accountChanged({ ...a, paid: 100 }, a), true)
})

test('тривога боргу: лише коли недоїмка або пеня зросли', () => {
  const [a] = L.mapAccounts(splatp, 2019)
  assert.equal(L.debtAlert(a, a), null)
  const debt = { ...a, arrears: 1500, penalty_balance: 12.5 }
  const msg = L.debtAlert(a, debt)
  assert.match(msg, /Недоїмка: 1\s?500 ₴/)
  assert.match(msg, /Пеня до сплати: 12,5 ₴/)
  assert.match(msg, /UA058999980000031115063026011/)
  assert.equal(L.debtAlert(debt, debt), null)          // той самий борг — не повторюємо
  assert.equal(L.debtAlert(debt, { ...debt, arrears: 0, penalty_balance: 0 }), null)  // борг погашено
})

test('вхідні листи: рік для PDF — periodYear, видалені пропускаємо', () => {
  const { letters, last } = L.mapLetters({ content: [
    { id:231140000018730, cdoc:'J1499202', dateIn:'2021-05-05 16:11:32', isRead:0, isDel:0, periodYear:2019, status:-1, name:'Квитанцiя № 2[J1499202]' },
    { id:2, isDel:1, name:'видалено' },
  ], last:false })
  assert.equal(last, false)
  assert.equal(letters.length, 1)
  assert.deepEqual([letters[0].id, letters[0].year, letters[0].read_in_dps], ['231140000018730', 2019, false])
  assert.match(L.letterAlert(letters[0]), /Квитанцiя № 2/)
})

test('звітність: статус без переносів рядка', () => {
  const [r] = L.mapReports({ content: [{ codRegdoc:999950000008140, csti:2705, doc:'J0200120', periodMonth:8, periodType:1, periodYear:2020,
    dterm:'2020-07-20 00:00:00', dget:'2020-09-21 22:03:07', nreg:37374323, flagName:'Прийнято в режимі On-line,\n dозволено тільки перегляд',
    docName:'Податкова декларацiя', period:'Серпень 2020' }] })
  assert.equal(r.id, '999950000008140')
  assert.equal(r.status, 'Прийнято в режимі On-line, dозволено тільки перегляд')
  assert.equal(r.reg_number, '37374323')
})

test('періоди звітності: останні 4 місяці й кінці кварталів, без майбутніх', () => {
  const p = L.reportPeriods(new Date('2026-11-07T10:00:00Z')).map(x => `${x.year}-${x.month}`)
  for (const k of ['2026-11', '2026-10', '2026-9', '2026-8', '2026-3', '2026-6', '2025-12']) assert.ok(p.includes(k), k)
  assert.ok(!p.includes('2026-12'))
  assert.deepEqual(L.accountYears(new Date('2026-02-10T00:00:00Z')), [2025, 2026])
  assert.deepEqual(L.accountYears(new Date('2026-11-07T00:00:00Z')), [2026])
})

test('токен: лише Base64 PKCS#7, пробіли й префікс прибираються', () => {
  const t = 'MII' + 'A'.repeat(800) + '=='
  assert.equal(L.normalizeToken(`Authorization: ${t.slice(0, 400)}\n${t.slice(400)}`), t)
  assert.equal(L.normalizeToken('1234567890'), null)
  assert.equal(L.normalizeToken('MII' + '!'.repeat(800)), null)
})

test('файли: лише числові id, лише дозволені шляхи ДПС', () => {
  assert.deepEqual(L.filePaths('letter', 2019, '231140000018730'), ['post/incoming/2019/231140000018730/pdf', 'incoming/2019/231140000018730/pdf'])
  assert.deepEqual(L.filePaths('report', '2020', 1), ['reg_doc/doc/2020/1/pdf'])
  assert.equal(L.filePaths('letter', 2019, '../payer_card'), null)
  assert.equal(L.filePaths('other', 2019, 1), null)
  assert.equal(L.filePaths('letter', 'x', 1), null)
})
