import { useState } from 'react'
import { Btn, SectionTitle, Card } from '../ui.jsx'

export default function Import({ data, save }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)

  const doImport = () => {
    const lines = text.trim().split('\n').filter(Boolean)
    const txs = lines.map(line => {
      const p = line.split('|').map(s => s.trim())
      if (p.length < 4) return null
      return {
        id: Date.now() + Math.random(),
        date: p[0], type: p[1], category: p[2],
        amount: parseFloat(p[3]),
        counterparty: p[4] || '', note: p[5] || ''
      }
    }).filter(Boolean)

    if (txs.length) {
      save({ ...data, transactions: [...data.transactions, ...txs] })
      setResult({ ok: txs.length, fail: lines.length - txs.length })
      setText('')
    }
  }

  const count = text.trim().split('\n').filter(Boolean).length

  return (
    <div>
      <Card>
        <SectionTitle>⬆ Масовий імпорт транзакцій</SectionTitle>

        <div style={{ background:'#faf9f7', border:'1px solid #e8e4dc', borderRadius:10, padding:16, marginBottom:18, fontSize:13, color:'#78716c', lineHeight:2.1 }}>
          <b style={{ color:'#1a1a1a' }}>Формат рядка:</b><br/>
          <code style={{ background:'#f0ede8', padding:'2px 8px', borderRadius:5, color:'#2c5f2e', fontFamily:'monospace' }}>
            ДАТА | тип | категорія | сума | контрагент
          </code><br/>
          <b>Тип:</b> <code style={{ color:'#16a34a' }}>income</code> або <code style={{ color:'#dc2626' }}>expense</code><br/>
          <b>Доходи:</b> <code style={{ color:'#2c5f2e' }}>commission · subscription · tourism</code><br/>
          <b>Витрати:</b> <code style={{ color:'#dc2626' }}>tech · staff · marketing · operations · tour_costs · personal</code>
        </div>

        <div style={{ background:'#faf9f7', border:'1px solid #e8e4dc', borderRadius:10, padding:14, marginBottom:16, fontSize:12, color:'#b0a898', lineHeight:2.2, fontFamily:'monospace' }}>
          2026-05-05 | income | commission | 8500 | Готель Затишок<br/>
          2026-05-10 | expense | tech | 1200 | FinMap<br/>
          2026-05-12 | income | tourism | 30000 | Тур Карпати<br/>
          2026-05-14 | expense | personal | 5000 | Вивів собі
        </div>

        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setResult(null) }}
          placeholder="Вставте дані тут..."
          style={{
            width: '100%', minHeight: 240,
            background: '#faf9f7', border: '1px solid #e8e4dc',
            borderRadius: 10, padding: 14, color: '#1a1a1a',
            fontSize: 13, resize: 'vertical', outline: 'none',
            boxSizing: 'border-box', fontFamily: 'monospace', lineHeight: 1.8
          }}
        />

        <div style={{ display:'flex', alignItems:'center', gap:14, marginTop:14 }}>
          <Btn onClick={doImport} style={{ background:'#2c5f2e' }}>
            ⬆ Імпортувати ({count} рядків)
          </Btn>
          {result && (
            <div style={{ fontSize:13, color:'#16a34a', fontWeight:600 }}>
              ✓ Додано {result.ok} записів{result.fail>0?`, пропущено ${result.fail}`:''}
            </div>
          )}
        </div>
      </Card>

      {/* Danger zone */}
      <Card style={{ marginTop:16, borderColor:'#fecaca' }}>
        <SectionTitle>⚠ Управління даними</SectionTitle>
        <div style={{ display:'flex', gap:10 }}>
          <Btn variant="danger" style={{ fontSize:12, padding:'7px 14px' }}
            onClick={() => {
              if (window.confirm('Видалити всі транзакції? Цю дію не можна скасувати.')) {
                save({ ...data, transactions: [] })
              }
            }}>
            Очистити транзакції
          </Btn>
          <Btn variant="ghost" style={{ fontSize:12, padding:'7px 14px' }}
            onClick={() => {
              const json = JSON.stringify(data, null, 2)
              const blob = new Blob([json], { type:'application/json' })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = `findash-backup-${new Date().toISOString().split('T')[0]}.json`
              a.click()
            }}>
            💾 Скачати резервну копію
          </Btn>
        </div>
      </Card>
    </div>
  )
}
