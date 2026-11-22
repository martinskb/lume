import { useEffect, useState } from 'react'
import { BackLink } from '../nav/useGo'
import type { Conclusion } from '../api/types'
import { Cover } from '../topics/Cover'
import type { PaletteName } from '../topics/cover'
import { playSound } from '../ui/sound'
import { Vinyl } from '../vinyl/Vinyl'
import { TopicDiscCard } from './TopicDiscCard'

type Props = {
  result: Conclusion
  minutes: number
  backTo: string
  backLabel: string
  /** Disco da sessão (cores da capa e título), para ele voltar à capa. */
  disc: { title: string; palette: PaletteName; level?: string }
}

/** Conta de `from` até `to` em ~0,9 s (salta direto se a pessoa prefere menos movimento). */
function useCountUp(from: number, to: number): number {
  const [value, setValue] = useState(from)
  useEffect(() => {
    let frame = 0
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || from === to) {
      frame = requestAnimationFrame(() => setValue(to))
      return () => cancelAnimationFrame(frame)
    }
    const start = performance.now() + 350
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / 900))
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(from + (to - from) * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [from, to])
  return value
}

export function Celebration({ result, minutes, backTo, backLabel, disc }: Props) {
  const grew = result.streak_after > result.streak_before
  const shown = useCountUp(result.streak_before, result.streak_after)
  useEffect(() => {
    const id = setTimeout(() => playSound(grew ? 'streak' : 'complete'), 300)
    return () => clearTimeout(id)
  }, [grew])
  const level = result.topic?.after.level ?? disc.level
  const coverTopic = {
    id: result.topic?.id ?? -1,
    title: disc.title,
    palette: disc.palette,
    cover: null,
    level: { name: level ?? 'Vinil', next_name: null, progress: 0, seconds_to_next: 0 },
  }

  return (
    <main className="shell narrow celebration">
      <div className="celebration-glow" aria-hidden="true" />
      <div className="tuck" aria-hidden="true">
        <Vinyl palette={disc.palette} level={level} className="tuck-disc" />
        <Cover topic={coverTopic} />
      </div>

      <div className="stack center pop" style={{ gap: 'var(--space-1)' }}>
        <span className="celebration-eyebrow">{grew ? 'Ofensiva estendida' : 'Sessão concluída'}</span>
        <div className="row" style={{ justifyContent: 'center', alignItems: 'baseline', gap: 'var(--space-3)' }}>
          {grew && <span className="big-number muted" style={{ fontSize: '2.6rem' }}>{result.streak_before}</span>}
          {grew && <span className="muted" aria-hidden>→</span>}
          <span className="big-number">{shown}</span>
        </div>
        <span className="muted">{result.streak_after === 1 ? 'dia seguido' : 'dias seguidos'}</span>
      </div>

      <div className="celebration-stats">
        <div><span className="muted small">Tempo</span><strong>{minutes} min</strong></div>
        <div><span className="muted small">Pontos</span><strong>{result.points > 0 ? `+${result.points}` : '0'}</strong></div>
        <div><span className="muted small">Meta</span><strong>{result.goal_met ? 'Cumprida' : 'Não foi'}</strong></div>
      </div>
      {result.points === 0 && (
        <p className="muted small" style={{ textAlign: 'center' }}>Sessões de 20 min ou mais valem pontos. Esta ficou registrada do mesmo jeito.</p>
      )}

      {result.topic && <TopicDiscCard light={result.topic} palette={disc.palette} />}

      <div className="stack" style={{ gap: 'var(--space-2)', marginTop: 'auto' }}>
        <BackLink className="btn primary block" to={backTo}>{backLabel}</BackLink>
        {backTo !== '/' && <BackLink className="btn ghost block" to="/">Ir para a estante</BackLink>}
      </div>
    </main>
  )
}
