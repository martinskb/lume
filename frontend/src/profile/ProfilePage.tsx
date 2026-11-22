import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, api } from '../api/client'
import type { Me } from '../api/types'
import { useApi } from '../api/useApi'
import { clearLogin, saveLogin, getToken } from '../auth/auth'
import { formatHours } from '../topics/cover'
import { Avatar } from '../ui/Avatar'
import { InstallRow } from '../ui/InstallInvite'
import { StudyMusicSection } from './StudyMusicSection'
import { PageSkeleton } from '../ui/Skeleton'
import { playSound, soundSetting } from '../ui/sound'

type Stats = {
  total_seconds: number
  sessions: number
  topics: number
  longest_streak: number
  best_level: { name: string; topic: string } | null
  member_since: string
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { data: me, setData: setMe } = useApi<Me>('/me')
  const { data: stats } = useApi<Stats>('/me/stats')
  const [nickname, setNickname] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [sound, setSound] = useState(soundSetting.enabled())

  if (!me) return <PageSkeleton variant="list" />
  const value = nickname ?? me.nickname
  const valid = /^[A-Za-z0-9_]{3,20}$/.test(value)

  async function rename(e: FormEvent) {
    e.preventDefault()
    if (!me) return
    setBusy(true)
    setMessage(null)
    try {
      const updated = await api<Me>('/me', { method: 'PATCH', body: JSON.stringify({ nickname: value }) })
      setMe(updated)
      saveLogin(getToken() ?? '', updated.nickname)
      setNickname(null)
      setMessage({ ok: true, text: 'Apelido atualizado. Entre com ele e o mesmo PIN.' })
    } catch (err) {
      const text = err instanceof ApiError && err.status === 422 ? 'Use de 3 a 20 letras, números ou _.' : err instanceof Error ? err.message : 'Não deu para salvar.'
      setMessage({ ok: false, text })
    } finally {
      setBusy(false)
    }
  }

  function leave() {
    clearLogin()
    navigate('/entrar', { replace: true })
  }

  const since = stats ? new Date(`${stats.member_since}T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : ''

  return (
    <main className="shell narrow profile-page">
      <div className="columns profile-cols">
      <div className="profile-side">
      <section className="profile-head">
        <Avatar nickname={me.nickname} size={88} />
        <div className="stack" style={{ gap: 'var(--space-1)' }}>
          <h1>{me.nickname}</h1>
          {since && <span className="muted small">No Lume desde {since}</span>}
        </div>
      </section>

      {stats && (
        <section className="stat-grid" aria-label="Seus números">
          <div className="card"><div className="stat" style={{ color: 'var(--accent-ink)' }}>{formatHours(stats.total_seconds)}</div><span className="muted small">focadas no total</span></div>
          <div className="card"><div className="stat">{stats.longest_streak}</div><span className="muted small">maior ofensiva (dias)</span></div>
          <div className="card"><div className="stat">{stats.topics}</div><span className="muted small">{stats.topics === 1 ? 'tema' : 'temas'}</span></div>
          <div className="card">
            <div className="stat">{stats.best_level?.name ?? '—'}</div>
            <span className="muted small truncate">{stats.best_level ? `nível mais alto · ${stats.best_level.topic}` : 'nível mais alto'}</span>
          </div>
        </section>
      )}
      </div>

      <div>
      <form className="card stack" style={{ gap: 'var(--space-3)' }} onSubmit={rename}>
        <label>
          Apelido
          <input value={value} maxLength={20} autoCapitalize="none" onChange={(e) => setNickname(e.target.value.trim())} />
        </label>
        {message && <p className={message.ok ? 'muted small' : 'error'} role={message.ok ? 'status' : 'alert'}>{message.text}</p>}
        <button className="btn soft" disabled={busy || !valid || value === me.nickname}>{busy ? 'Salvando…' : 'Salvar apelido'}</button>
      </form>

      <section className="card stack" style={{ gap: 'var(--space-4)' }} aria-label="Preferências">
        <label className="switch-row">
          <span className="stack" style={{ gap: 2 }}>
            <span>Sons de conquista</span>
            <span className="muted small" style={{ fontWeight: 500 }}>Ao concluir sessões e acertar exercícios</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={sound}
            onChange={(e) => {
              soundSetting.set(e.target.checked)
              setSound(e.target.checked)
              if (e.target.checked) playSound('right')
            }}
          />
        </label>
        <InstallRow />
      </section>

      <StudyMusicSection />

      <section className="card stack google-card" style={{ gap: 'var(--space-3)' }} aria-label="Conectar com Google">
        <div className="section-title">
          <h2>Conectar com Google</h2>
          <span className="pill soft">em breve</span>
        </div>
        <ul className="unlock-list">
          <li>Backup e sincronização da sua conta</li>
          <li>Participar do ranking com conta verificada</li>
          <li>Foto de perfil (a do Google ou uma sua)</li>
        </ul>
      </section>

      <button className="btn ghost block" onClick={leave}>Sair da conta</button>
      </div>
      </div>
    </main>
  )
}
