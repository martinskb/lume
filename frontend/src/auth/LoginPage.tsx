import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, post } from '../api/client'
import type { EnterResponse } from '../api/types'
import { Vinyl } from '../vinyl/Vinyl'
import { Logo } from '../brand/Logo'
import { saveLogin } from './auth'

export function LoginPage() {
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const nicknameOk = /^[A-Za-z0-9_]{3,20}$/.test(nickname)
  const pinOk = /^\d{4}$/.test(pin)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const r = await post<EnterResponse>('/auth/enter', { nickname, pin })
      saveLogin(r.token, r.user.nickname)
      navigate('/', { replace: true })
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      if (status === 401) setError('PIN incorreto para esse apelido.')
      else if (status === 429) setError('Muitas tentativas. Espere 5 minutos.')
      else setError(err instanceof Error ? err.message : 'Não deu para entrar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login scene">
      <section className="login-hero">
        <Logo size={36} />
        <div className="login-stage" aria-hidden="true">
          <span className="login-glow" />
          <Vinyl palette="noite" level="Ouro" spinning className="hero-disc" />
        </div>
        <div className="login-copy">
          <h2>Um disco de cada vez.</h2>
          <p>O caminho já existe. O Lume ilumina.</p>
        </div>
      </section>
      <div className="login-form">
        <h1>Entrar</h1>
        <form className="stack" style={{ gap: 'var(--space-4)' }} onSubmit={submit}>
          <label>
            Apelido
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value.trim())}
              autoCapitalize="none"
              autoComplete="username"
              maxLength={20}
            />
            {nickname && !nicknameOk && (
              <span className="muted small" style={{ fontWeight: 500 }}>3 a 20 letras, números ou _</span>
            )}
          </label>
          <label>
            PIN de 4 números
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              type="password"
              autoComplete="current-password"
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn primary block" disabled={!nicknameOk || !pinOk || busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
          {busy && (
            <p className="muted small" role="status">
              Se o servidor estava parado, o primeiro acesso pode levar até 1 minuto.
            </p>
          )}
        </form>

      </div>
    </main>
  )
}
