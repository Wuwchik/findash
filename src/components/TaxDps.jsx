import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, SectionTitle, Btn, Modal } from '../ui.jsx'
import { p7sToToken } from '../p7sCompact.js'
import { loadDps, syncDps, setDpsToken, clearDpsToken, openDpsFile, markLetterSeen } from '../taxDpsStorage.js'

// Дані з Електронного кабінету ДПС: стан розрахунків, реквізити, листи, звітність.
// Оновлює сервер кожні 15 хв (tax-dps-sync); тут — показ і дії власника.

const note = { fontSize: 12, lineHeight: 1.6, color: '#78716c' }
const uah = v => v === null || v === undefined ? '—' : new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(v)
const when = v => v ? new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(v)) : '—'
const day = v => v ? new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${v}T12:00:00`)) : '—'
const pos = v => Number(v) > 0.009

const STATUS = {
  ok:       { text: 'ДПС: підключено', bg: '#f0fdf4', border: '#86efac', color: '#166534' },
  missing:  { text: 'ДПС: не підключено', bg: '#fef9e7', border: '#fde68a', color: '#92400e' },
  rejected: { text: 'ДПС: підпис застарів', bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' },
  error:    { text: 'ДПС: помилка оновлення', bg: '#fff7ed', border: '#fed7aa', color: '#9a3412' },
}

function Copy({ value }) {
  const [done, setDone] = useState(false)
  if (!value) return null
  return <button type="button" onClick={() => navigator.clipboard?.writeText(String(value)).then(() => { setDone(true); setTimeout(() => setDone(false), 1500) })}
    style={{ border: '1px solid #e8e4dc', background: '#fff', borderRadius: 6, padding: '2px 7px', fontSize: 11, cursor: 'pointer', color: '#2c5f2e', marginLeft: 6 }}>
    {done ? '✓' : 'Копіювати'}
  </button>
}

const KEY_FILES = /\.(dat|jks|pfx|p12|zs2|pk8|key)$/i

/** .p7s (двійковий або Base64-текст) → компактний підпис (CAdES-BES) у Base64 — інакше ДПС: «заголовок завеликий» */
async function fileToToken(file) {
  return p7sToToken(new Uint8Array(await file.arrayBuffer()))
}

function ConnectModal({ onClose, onDone }) {
  const [token, setToken] = useState('')
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function pick(file) {
    setError('')
    if (!file) return
    if (KEY_FILES.test(file.name)) {
      setError('Це файл особистого ключа. Його НЕ потрібно завантажувати — потрібен лише підписаний файл .p7s з кроку 3.')
      return
    }
    if (file.size > 60000) { setError('Файл завеликий для підписаного РНОКПП. Підпишіть файл, що містить лише 10 цифр.'); return }
    try { setToken(await fileToToken(file)); setFileName(file.name) }
    catch (e) { setError(`Не вдалося прочитати підпис: ${e.message}. Підпишіть rnokpp.txt як «дані та підпис в одному файлі» (CAdES, .p7s), не .asice.`) }
  }
  async function submit() {
    setBusy(true); setError('')
    try { await setDpsToken(token); onDone() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const step = { ...note, color: '#1a1a1a', marginBottom: 10 }
  return <Modal title="🔐 Підключити Електронний кабінет" onClose={onClose}>
    <div style={{ ...note, marginBottom: 14 }}>
      Ключ КЕП і пароль <strong>не передаються</strong> в A.U.R.A — лише підписаний РНОКПП. Він дає тільки читання
      податкових даних, підписати ним документ чи подати звіт неможливо. <strong>ДПС приймає такий підпис лише в день
      підписання</strong>, тож щоб оновити дані, підписуйте <code>rnokpp.txt</code> заново (той самий файл) — це хвилина.
    </div>
    <div style={step}><strong>1.</strong> У Блокноті створіть файл <code>rnokpp.txt</code>, у якому лише ваш РНОКПП — 10 цифр, без пробілів і нового рядка.</div>
    <div style={step}><strong>2.</strong> Відкрийте офіційний сервіс підпису ЦЗО:{' '}
      <a href="https://czo.gov.ua/sign" target="_blank" rel="noopener noreferrer" style={{ color: '#2c5f2e', fontWeight: 700 }}>czo.gov.ua/sign ↗</a>{' '}
      і зчитайте свій КЕП (той самий, яким входите в кабінет ДПС).</div>
    <div style={step}><strong>3.</strong> Підпишіть <code>rnokpp.txt</code>: формат <em>CAdES</em> (не ASiC/.asice), тип — <em>«дані та підпис в одному файлі»</em>, з сертифікатом. Збережіть результат <code>.p7s</code>.</div>
    <div style={step}><strong>4.</strong> Оберіть цей <code>.p7s</code> тут:</div>
    <input type="file" accept=".p7s,.txt,.sig" onChange={e => pick(e.target.files?.[0])} style={{ fontSize: 12, marginBottom: 8 }} />
    {fileName && token && <div style={{ ...note, color: '#166534' }}>✓ {fileName} прочитано</div>}
    <details style={{ margin: '8px 0 14px' }}>
      <summary style={{ ...note, cursor: 'pointer' }}>або вставити підпис у Base64 текстом</summary>
      <textarea value={token} onChange={e => { setToken(e.target.value); setFileName('') }} rows={4} placeholder="MII…"
        style={{ width: '100%', fontSize: 11, fontFamily: 'monospace', border: '1px solid #e8e4dc', borderRadius: 8, padding: 8, marginTop: 6, boxSizing: 'border-box' }} />
    </details>
    <div style={{ border: '1px solid #fed7aa', background: '#fff7ed', borderRadius: 10, padding: 10, marginBottom: 14, fontSize: 12, lineHeight: 1.55, color: '#9a3412' }}>
      ⚠️ Не завантажуйте сюди файл ключа (Key-6.dat, .jks, .pfx) і не вводьте пароль — A.U.R.A їх не просить.
    </div>
    {error && <div role="alert" style={{ background: '#fef2f2', color: '#b91c1c', padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{error}</div>}
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <Btn variant="ghost" onClick={onClose}>Скасувати</Btn>
      <Btn disabled={!token.trim() || busy} onClick={submit}>{busy ? '⏳ Перевіряю в ДПС…' : 'Перевірити й підключити'}</Btn>
    </div>
  </Modal>
}

function AccountRow({ a, ops }) {
  const [open, setOpen] = useState(false)
  const debt = pos(a.arrears) || pos(a.penalty_balance)
  return <div style={{ background: '#faf9f7', border: '1px solid #e8e4dc', borderLeft: `3px solid ${debt ? '#dc2626' : pos(a.overpaid) ? '#0891b2' : '#16a34a'}`, borderRadius: 11, padding: 14, marginBottom: 8 }}>
    <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', cursor: 'pointer' }}>
      <div style={{ flex: '1 1 220px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{a.name || 'Платіж'} <span style={{ ...note, fontWeight: 400 }}>· {a.budget_code} · {a.year}</span></div>
        <div style={{ ...note, marginTop: 3 }}>Нараховано {uah(a.accrued)} · Сплачено {uah(a.paid)}{pos(a.refunded) ? ` · Повернуто ${uah(a.refunded)}` : ''}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {pos(a.arrears) && <div style={{ fontWeight: 800, color: '#dc2626' }}>Борг {uah(a.arrears)}</div>}
        {pos(a.penalty_balance) && <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 12 }}>Пеня {uah(a.penalty_balance)}</div>}
        {pos(a.overpaid) && <div style={{ fontWeight: 700, color: '#0891b2' }}>Переплата {uah(a.overpaid)}</div>}
        {!debt && !pos(a.overpaid) && <div style={{ fontWeight: 700, color: '#16a34a' }}>✓ Без боргу</div>}
        <div style={{ ...note, fontSize: 11 }}>{open ? 'Згорнути ▲' : 'Реквізити й операції ▼'}</div>
      </div>
    </div>
    {open && <div style={{ marginTop: 12, borderTop: '1px solid #e8e4dc', paddingTop: 12 }}>
      <div style={{ ...note, color: '#1a1a1a' }}>
        <div><strong>IBAN:</strong> {a.iban || '—'}<Copy value={a.iban} /></div>
        <div><strong>Код отримувача (ЄДРПОУ):</strong> {a.recipient_code || '—'}<Copy value={a.recipient_code} /></div>
        <div><strong>Отримувач:</strong> {a.recipient_name || '—'}</div>
        <div><strong>Банк:</strong> {a.bank_name || '—'}</div>
        <div><strong>Податкова:</strong> {a.sti_name || '—'}</div>
      </div>
      <div style={{ ...note, fontWeight: 700, marginTop: 12, marginBottom: 6 }}>Операції за {a.year} рік</div>
      {ops.length === 0 && <div style={note}>Операцій немає або ще не завантажено.</div>}
      {ops.slice(0, 30).map(o => <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: '1px dashed #e8e4dc', fontSize: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#1a1a1a' }}>{day(o.op_date)} · {o.name || o.code}</div>
          {o.comment && <div style={{ ...note, fontSize: 11 }}>{o.comment}</div>}
        </div>
        <div style={{ whiteSpace: 'nowrap', fontWeight: 700, color: pos(o.accrued) ? '#dc2626' : '#16a34a' }}>
          {pos(o.accrued) ? `+${uah(o.accrued)} нарах.` : uah(o.paid ?? o.amount)}
        </div>
      </div>)}
    </div>}
  </div>
}

export default function TaxDps({ onChange }) {
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [connect, setConnect] = useState(false)
  const [showAllLetters, setShowAllLetters] = useState(false)

  const load = useCallback(async () => {
    try { setD(await loadDps()); setError('') } catch (e) { setError(`Не вдалося прочитати дані ДПС: ${e.message}`) }
  }, [])
  useEffect(() => { load(); const t = setInterval(load, 120000); return () => clearInterval(t) }, [load])

  const st = d?.state || { token_status: 'missing' }
  const s = STATUS[st.token_status] || STATUS.missing
  const latestYear = useMemo(() => Math.max(0, ...(d?.accounts || []).map(a => a.year)), [d])
  const accounts = (d?.accounts || []).filter(a => a.year === latestYear)
  const totals = accounts.reduce((t, a) => ({ arrears: t.arrears + Math.max(0, +a.arrears || 0), penalty: t.penalty + Math.max(0, +a.penalty_balance || 0), overpaid: t.overpaid + Math.max(0, +a.overpaid || 0) }), { arrears: 0, penalty: 0, overpaid: 0 })
  const unread = (d?.letters || []).filter(l => !l.seen_at)
  const letters = showAllLetters ? d?.letters || [] : (d?.letters || []).slice(0, 10)

  async function run(fn) {
    setBusy(true); setError('')
    try { const r = await fn(); if (r?.status === 'rejected' || r?.status === 'error') setError(r.error) } catch (e) { setError(e.message) }
    finally { setBusy(false); await load(); onChange?.() }
  }
  async function open(kind, row) {
    try {
      await openDpsFile(kind === 'letter'
        ? { kind, year: row.year, altYear: row.date_in?.slice(0, 4), id: row.id }
        : { kind, year: row.period_year ?? row.year, altYear: row.year, id: row.id })
      if (kind === 'letter') { await load(); onChange?.() }
    } catch (e) { setError(`Документ не відкрився: ${e.message}`) }
  }
  async function markAllSeen() {
    await Promise.all(unread.map(l => markLetterSeen(l.id)))
    await load(); onChange?.()
  }

  return <Card style={{ marginBottom: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
      <div>
        <SectionTitle>Електронний кабінет ДПС</SectionTitle>
        <div style={{ ...note, marginTop: -10 }}>
          {st.payer_name ? <strong style={{ color: '#1a1a1a' }}>{st.payer_name} · </strong> : null}
          {st.last_ok_at ? `Дані станом на ${when(st.last_ok_at)}${st.token_status === 'ok' ? ' · оновлюються кожні 15 хв до кінця дня підпису' : ''}` : 'Дані ще не отримано'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, borderRadius: 10, padding: '8px 12px', fontWeight: 700, fontSize: 12 }}>{s.text}</span>
        {st.token_status !== 'missing' && <Btn variant="ghost" disabled={busy} onClick={() => run(syncDps)}>{busy ? '⏳' : '🔄'} Оновити</Btn>}
        <Btn variant={st.token_status === 'ok' ? 'ghost' : 'primary'} onClick={() => setConnect(true)}>
          {st.token_status === 'missing' ? '🔐 Підключити ДПС' : '🔐 Підписати заново'}
        </Btn>
        {st.token_status !== 'missing' && <Btn variant="ghost" disabled={busy} onClick={() => window.confirm('Відключити ДПС? Збережені дані залишаться, але перестануть оновлюватись.') && run(clearDpsToken)}>Відключити</Btn>}
      </div>
    </div>

    {st.token_status === 'rejected' && <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: 12, borderRadius: 10, fontSize: 12, marginBottom: 12 }}>
      🔐 Підпис для ДПС діє лише в день підписання, тому дані нижче — станом на останнє оновлення. Щоб оновити: підпишіть <code>rnokpp.txt</code> на czo.gov.ua і натисніть «Підписати заново» — це хвилина.
    </div>}
    {(error || (st.token_status === 'error' && st.last_error)) && <div role="alert" style={{ background: '#fff7ed', color: '#9a3412', padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{error || st.last_error}</div>}

    {st.token_status === 'missing' && !d?.accounts?.length && <div style={note}>
      Після підключення тут з'являться: стан розрахунків з бюджетом (борг, переплата, пеня) по кожному податку з реквізитами для сплати,
      усі листи й квитанції з податкової і статуси поданої звітності. Про новий лист чи борг A.U.R.A одразу напише в Telegram.
    </div>}

    {!!accounts.length && <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {[['Борг (недоїмка)', totals.arrears, '#dc2626'], ['Пеня', totals.penalty, '#dc2626'], ['Переплата', totals.overpaid, '#0891b2']].map(([l, v, c]) =>
          <div key={l} style={{ flex: '1 1 150px', background: '#fff', border: '1px solid #e8e4dc', borderLeft: `3px solid ${v > 0 ? c : '#16a34a'}`, borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontSize: 10, color: '#b0a898', letterSpacing: 1.2, textTransform: 'uppercase' }}>{l} · {latestYear}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: v > 0 ? c : '#16a34a', marginTop: 3 }}>{uah(v)}</div>
          </div>)}
      </div>
      <div style={{ ...note, fontWeight: 700, marginBottom: 8 }}>Стан розрахунків з бюджетом · {latestYear}</div>
      {accounts.map(a => <AccountRow key={a.id} a={a} ops={(d.operations || []).filter(o => o.account_id === a.id)} />)}
    </>}

    {!!d?.letters?.length && <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ ...note, fontWeight: 700 }}>📨 Листи й квитанції від ДПС {unread.length ? <span style={{ color: '#dc2626' }}>· нових {unread.length}</span> : ''}</div>
        {!!unread.length && <button onClick={markAllSeen} style={{ border: 0, background: 'none', color: '#2c5f2e', fontSize: 12, cursor: 'pointer' }}>Позначити всі прочитаними</button>}
      </div>
      {letters.map(l => <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 12px', marginBottom: 6, borderRadius: 10,
        background: l.seen_at ? '#faf9f7' : '#fef9e7', border: `1px solid ${l.seen_at ? '#e8e4dc' : '#fde68a'}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: l.seen_at ? 500 : 700, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis' }}>{!l.seen_at && '🆕 '}{l.name || l.cdoc}</div>
          <div style={{ ...note, fontSize: 11 }}>{when(l.date_in)}{l.cdoc ? ` · ${l.cdoc}` : ''}</div>
        </div>
        <Btn variant="outline" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => open('letter', l)}>PDF</Btn>
      </div>)}
      {(d.letters.length > 10) && <button onClick={() => setShowAllLetters(v => !v)} style={{ border: 0, background: 'none', color: '#2c5f2e', fontSize: 12, cursor: 'pointer' }}>
        {showAllLetters ? 'Показати менше' : `Показати всі (${d.letters.length})`}
      </button>}
    </div>}

    {!!d?.reports?.length && <div style={{ marginTop: 20 }}>
      <div style={{ ...note, fontWeight: 700, marginBottom: 8 }}>📑 Подана звітність</div>
      {d.reports.filter(r => !r.ref_id).slice(0, 15).map(r => <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 12px', marginBottom: 6, borderRadius: 10, background: '#faf9f7', border: '1px solid #e8e4dc' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{r.name || r.code} {r.period ? <span style={{ ...note }}>· {r.period}</span> : null}</div>
          <div style={{ ...note, fontSize: 11 }}>{when(r.received_at)} · №{r.reg_number || '—'} · <span style={{ color: /прийнят|зареєстр/i.test(r.status || '') ? '#166534' : /не прийн|відмов|помилк/i.test(r.status || '') ? '#b91c1c' : '#78716c', fontWeight: 600 }}>{r.status || 'статус невідомий'}</span></div>
        </div>
        <Btn variant="outline" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => open('report', r)}>PDF</Btn>
      </div>)}
    </div>}

    {connect && <ConnectModal onClose={() => setConnect(false)} onDone={() => { setConnect(false); load(); onChange?.() }} />}
  </Card>
}
