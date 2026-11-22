import { useState } from 'react'
import { put } from '../api/client'
import type { Me, Ranking } from '../api/types'
import { useApi } from '../api/useApi'
import { getNickname } from '../auth/auth'
import { CardSkeleton } from '../ui/Skeleton'
import { Tip } from '../ui/Tip'
import { Avatar } from '../ui/Avatar'
import { DiscAvatar } from '../ui/DiscAvatar'

const PODIUM_FINISH = ['Ouro', 'Prata', 'Vinil']

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
        <>
          <ol className="podium" aria-label="Pódio">
            {ranking.top.slice(0, 3).map((row, i) => (
              <li key={row.nickname} className={`podium-spot p${i + 1}${row.nickname === mine ? ' me' : ''}`}>
                <DiscAvatar nickname={row.nickname} level={PODIUM_FINISH[i]} size={i === 0 ? 112 : 88} />
                <strong className="truncate">{row.nickname}</strong>
                <span className="podium-points">{row.week_points} pts</span>
                <span className="podium-step" aria-label={`${i + 1}º lugar`}>{i + 1}</span>
              </li>
            ))}
          </ol>
          {ranking.top.length > 3 && (
            <ol className="card rank-list" start={4}>
              {ranking.top.slice(3).map((row, i) => (
                <li key={row.nickname} className={`rank-row${row.nickname === mine ? ' me' : ''}`}>
                  <span className="rank-pos">{i + 4}</span>
                  <Avatar nickname={row.nickname} size={34} />
                  <span className="grow truncate rank-name">{row.nickname}{row.nickname === mine ? ' · você' : ''}</span>
                  <span className="rank-streak" title="Ofensiva">{row.streak} {row.streak === 1 ? 'dia' : 'dias'}</span>
                  <strong className="rank-points">{row.week_points} pts</strong>
                </li>
              ))}
            </ol>
          )}
        </>
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
