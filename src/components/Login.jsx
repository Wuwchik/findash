import { useState } from 'react'
import { supabase } from '../storage'
import { Card, Btn, Input } from '../ui'

export default function Login() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Акаунт створено. Якщо потрібне підтвердження — перевірте пошту, інакше просто увійдіть.')
      }
    } catch (err) {
      setError(err.message || 'Помилка входу')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f3ef', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Card style={{ width: 'min(380px, 100%)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontFamily: "'Spectral', serif", fontSize: 24, fontWeight: 800, color: '#1a1a1a' }}>🏨 A.U.R.A</div>
          <div style={{ fontSize: 12, color: '#78716c', marginTop: 4 }}>
            {mode === 'signin' ? 'Вхід до фінансового аналітика' : 'Реєстрація'}
          </div>
        </div>
        <form onSubmit={submit}>
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <Input
            label="Пароль"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 14 }}>{error}</div>}
          {message && <div style={{ color: '#16a34a', fontSize: 12, marginBottom: 14 }}>{message}</div>}
          <Btn type="submit" disabled={loading} style={{ width: '100%', textAlign: 'center' }}>
            {loading ? 'Зачекайте…' : mode === 'signin' ? 'Увійти' : 'Зареєструватися'}
          </Btn>
        </form>
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <button
            onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); setMessage('') }}
            style={{ background: 'none', border: 'none', color: '#2c5f2e', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            {mode === 'signin' ? 'Немає акаунта? Зареєструватися' : 'Вже є акаунт? Увійти'}
          </button>
        </div>
      </Card>
    </div>
  )
}
