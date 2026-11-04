import { useState } from 'react'
import { Btn, Modal } from '../ui.jsx'

const link = { color:'#2c5f2e', fontSize:12, fontWeight:700, textDecoration:'underline', textUnderlineOffset:2 }
const box = { padding:14, borderRadius:12, border:'1px solid #e8e4dc', background:'#faf9f7', textAlign:'left', cursor:'pointer', width:'100%' }
const note = {fontSize:12, lineHeight:1.6, color:'#78716c'}

export default function TaxConnection() {
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState('file')
  return <>
    <Btn variant="outline" onClick={() => setOpen(true)}>🔐 Налаштувати підключення ДПС</Btn>
    {open && <Modal title="🔐 Підключення до ДПС" onClose={() => setOpen(false)}>
      <div style={{...note,marginBottom:15}}>
        Оберіть спосіб авторизації. Це <strong>майстер підготовки</strong>, а не діюче з’єднання:
        зараз система не відправляє підписаних запитів та не отримує даних ДПС.
      </div>
      <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>1. Яким підписом користуватись?</div>
      <div style={{display:'grid',gap:9,marginBottom:16}}>
        <button type="button" onClick={()=>setMethod('file')} aria-pressed={method==='file'} style={{...box,borderColor:method==='file'?'#2c5f2e':'#e8e4dc',background:method==='file'?'#f0fdf4':'#faf9f7'}}>
          <div style={{fontWeight:700,fontSize:14}}>🔑 Файловий КЕП ПриватБанку {method==='file'?'✓':''}</div>
          <div style={{...note,marginTop:4}}>Переважний варіант: майбутнє локальне підписання в браузері. Особистий ключ і пароль не повинні відправлятися в A.U.R.A.</div>
        </button>
        <button type="button" onClick={()=>setMethod('diia')} aria-pressed={method==='diia'} style={{...box,borderColor:method==='diia'?'#2c5f2e':'#e8e4dc',background:method==='diia'?'#f0fdf4':'#faf9f7'}}>
          <div style={{fontWeight:700,fontSize:14}}>📱 Дія.Підпис {method==='diia'?'✓':''}</div>
          <div style={{...note,marginTop:4}}>Мобільне підтвердження. Для A.U.R.A потрібно окремо підключити сервіс Дія.Підпис та узгодити формат підпису з API ДПС.</div>
        </button>
      </div>
      <div style={{border:'1px solid #dbeafe',background:'#eff6ff',borderRadius:11,padding:14,marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:13,color:'#1e40af',marginBottom:7}}>2. Що буде потрібно для роботи</div>
        {method==='file'
          ? <div style={{...note,color:'#1e40af'}}>На комп’ютері: криптографічний модуль, сумісний з КЕП ПриватБанку, створить підписаний ідентифікатор платника на твоєму пристрої. Після тестування підпису A.U.R.A зможе зробити запит до ДПС без завантаження приватного ключа на сервер.</div>
          : <div style={{...note,color:'#1e40af'}}>Підключення до Дії як розробника, створення запиту на підпис у застосунку та перевірка відповідності підпису формату Authorization, який вимагає ДПС. Простий вхід у ДПС через Дію сам по собі не надає API-токена для A.U.R.A.</div>}
      </div>
      <div style={{border:'1px solid #fed7aa',background:'#fff7ed',borderRadius:11,padding:12,marginBottom:16, fontSize:12,lineHeight:1.55,color:'#9a3412'}}>
        ⚠️ Не завантажуй файл особистого ключа, пароль, скріншот з кодами або вже сформований підписаний заголовок Authorization у чат, GitHub чи базу даних. Він може надавати доступ до приватної податкової інформації.
      </div>
      <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>3. Перевірені офіційні ресурси</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:10,marginBottom:18}}>
        <a style={link} href="https://cabinet.tax.gov.ua/help/api-registers-int.html" target="_blank" rel="noopener noreferrer">API приватної частини ДПС ↗</a>
        <a style={link} href="https://cabinet.tax.gov.ua/" target="_blank" rel="noopener noreferrer">Електронний кабінет ↗</a>
        {method==='diia' && <a style={link} href="https://integration.diia.gov.ua/signature.html" target="_blank" rel="noopener noreferrer">Інтеграція Дія.Підпис ↗</a>}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',alignItems:'center'}}>
        <span style={{...note,fontWeight:700}}>Статус: очікує реалізації криптопідпису</span>
        <Btn onClick={()=>setOpen(false)}>Зрозуміло</Btn>
      </div>
    </Modal>}
  </>
}
