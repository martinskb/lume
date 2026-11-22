import { useState } from 'react'
import { put } from '../api/client'
import type { Me, Ranking } from '../api/types'
import { useApi } from '../api/useApi'
import { getNickname } from '../auth/auth'
import { CardSkeleton } from '../ui/Skeleton'
import { Tip } from '../ui/Tip'
import { Avatar } from '../ui/Avatar'

export function RankingPage() {
  const { data: me, setData: setMe } = useApi<Me>('/me')
  const { data: ranking, error, reload } = useApi<Ranking>('/ranking')
  const [busy, setBusy] = useState(false)
  const [toggleError, setToggleError] = useState('')
  const mine = getNickname()

  async function toggle() {
    if (!me) return
    setBusy(true)
    setToggleError('')
    try {
      await put('/me/settings', { in_ranking: !me.in_ranking })
      setMe({ ...me, in_ranking: !me.in_ranking })
      reload()
    } catch {
      setToggleError('Não deu para salvar. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="shell narrow ranking-page">
      <h1>Ranking da semana</h1>

      <Tip id="ranking">Pontos de segunda a domingo. Só seu apelido aparece, e participar é opcional.</Tip>

      <div className="columns ranking-cols">
      <div className="ranking-list">

      {error && (
        <div className="notice warn stack">
          <p>{error}</p>
          <button className="btn" onClick={reload}>Tentar de novo</button>
        </div>
      )}
      {!ranking && !error && <CardSkeleton lines={6} title={false} />}
      {ranking && ranking.top.length === 0 && (
        <p className="muted">Ninguém no ranking ainda. Seja a primeira pessoa.</p>
      )}
      {ranking && ranking.top.length > 0 && (
        <ol className="card list">
          {ranking.top.map((row, i) => (
            <li key={row.nickname} className="row" style={{ fontWeight: row.nickname === mine ? 700 : 400 }}>
              <span className="muted" style={{ width: 28 }}>{i + 1}º</span>
              <Avatar nickname={row.nickname} size={32} />
              <span className="grow truncate">{row.nickname}{row.nickname === mine ? ' (você)' : ''}</span>
              <span className="pill" title="Ofensiva">{row.streak} {row.streak === 1 ? 'dia' : 'dias'}</span>
              <strong style={{ minWidth: 64, textAlign: 'right' }}>{row.week_points} pts</strong>
            </li>
          ))}
        </ol>
      )}
      </div>

      <aside className="ranking-side">
        {ranking?.me && (
          <div className="card ranking-me">
            <span className="muted small">Sua semana</span>
            <div className="row" style={{ alignItems: 'baseline', gap: 'var(--space-3)' }}>
              <span className="stat" style={{ color: 'var(--accent-ink)' }}>{ranking.me.position}º</span>
              <span className="muted">{ranking.me.week_points} pts</span>
            </div>
          </div>
        )}
        {me && !me.in_ranking && (
          <button className="btn primary block" onClick={toggle} disabled={busy}>Participar do ranking</button>
        )}
        {toggleError && <p className="error" role="alert">{toggleError}</p>}
        {me?.in_ranking && (
          <button className="btn ghost small ranking-leave" style={{ alignSelf: 'center' }} onClick={toggle} disabled={busy}>
            Sair do ranking
          </button>
        )}
      </aside>
      </div>
    </main>
  )
}
