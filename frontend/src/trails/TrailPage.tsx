import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BackLink } from '../nav/useGo'
import { ApiError, api, post } from '../api/client'
import type { CatalogItem, Topic, Trail, TrailPart } from '../api/types'
import { useApi } from '../api/useApi'
import type { PaletteName } from '../topics/cover'
import { AssistantPanel } from '../assistant/AssistantPanel'
import { GoalChips, OtherSession, RunningSession } from '../timer/Session'
import { useSession } from '../timer/useSession'
import { loadTimer } from '../timer/timerState'
import { PageSkeleton } from '../ui/Skeleton'
import { useWide } from '../ui/useWide'

const STEPS = ['dividindo o tema', 'buscando aulas', 'criando exercícios']
const STEP_LABEL = ['Dividindo o tema em partes', 'Buscando aulas no YouTube', 'Criando exercícios']
const POLL_MS = 2000
// O servidor só considera a geração travada depois de 10 min (STALE_AFTER): antes disso,
// "demorando" não é falha. Na demo, uma trilha levou 5,5 min e a tela desistiu aos 2.
const GIVE_UP_MS = 11 * 60_000
const SLOW_MS = 60_000

function duration(seconds: number): string {
  if (!seconds) return ''
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function TrailPage() {
  const { id } = useParams()
  const [trail, setTrail] = useState<Trail | null>(null)
  const [error, setError] = useState('')
  const [timedOut, setTimedOut] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    let stop = false
    let timer: ReturnType<typeof setTimeout>
    const started = Date.now()
    setTimedOut(false)
    setSlow(false)

    async function load() {
      try {
        const t = await api<Trail>(`/trails/${id}`)
        if (stop) return
        setTrail(t)
        setError('')
        if (t.status !== 'generating') return
      } catch (err) {
        if (stop) return
        if (err instanceof ApiError && err.status === 404) {
          setError('Trilha não encontrada.')
          return
        }
        // falha de rede no meio da geração: continua tentando até o limite
      }
      if (Date.now() - started > SLOW_MS) setSlow(true)
      if (Date.now() - started > GIVE_UP_MS) setTimedOut(true)
      else timer = setTimeout(load, POLL_MS)
    }

    void load()
    return () => {
      stop = true
      clearTimeout(timer)
    }
  }, [id, attempt])

  if (error) {
    return (
      <main className="shell">
        <p className="error" role="alert">{error}</p>
        <BackLink className="btn block" to="/">Voltar ao início</BackLink>
      </main>
    )
  }
  if (!trail) return <PageSkeleton variant="trail" />

  if (trail.status === 'failed' || timedOut) {
    return (
      <Failed
        trail={trail}
        timedOut={timedOut}
        onRetry={async () => {
          await post('/trails', { topic: trail.title, level: 'livre' })
          setAttempt((a) => a + 1)
        }}
      />
    )
  }
  if (trail.status === 'generating') return <Generating trail={trail} slow={slow} />
  return <Ready trail={trail} onChange={setTrail} />
}

function Generating({ trail, slow }: { trail: Trail; slow: boolean }) {
  const current = Math.max(0, STEPS.indexOf(trail.step))
  return (
    <main className="shell narrow">
      <div className="stack">
        <h1>{trail.title}</h1>
        <p className="muted">
          {slow
            ? 'Ainda montando. Pode sair: o disco aparece na estante quando ficar pronto.'
            : 'Montando sua trilha. Costuma levar menos de um minuto.'}
        </p>
      </div>
      <ol className="card list" aria-live="polite">
        {STEP_LABEL.map((label, i) => (
          <li key={label} className="row">
            <span aria-hidden style={{ width: 24, color: 'var(--accent-ink)' }}>
              {i < current ? '✓' : i === current ? '…' : ''}
            </span>
            <span className={i > current ? 'muted' : ''} style={{ fontWeight: i === current ? 700 : 400 }}>
              {label}
            </span>
          </li>
        ))}
      </ol>
    </main>
  )
}

function Failed({ trail, timedOut, onRetry }: { trail: Trail; timedOut: boolean; onRetry: () => Promise<void> }) {
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<CatalogItem[]>('/catalog').then((items) => setCatalog(items.slice(0, 3))).catch(() => {})
  }, [])

  const reason = timedOut
    ? 'Está demorando mais que o normal.'
    : trail.error === 'quota'
      ? 'O limite diário de buscas no YouTube acabou. Amanhã volta ao normal.'
      : trail.error === 'tema'
        ? 'Isso não parece algo para aprender. Escreva um tema, por exemplo "Fotossíntese", "Inglês básico" ou "Cronologia da Marvel".'
        : 'A IA não conseguiu montar essa trilha agora.'

  return (
    <main className="shell narrow">
      <div className="stack">
        <h1>{trail.title}</h1>
        <div className="notice warn stack">
          <strong>Não deu para montar essa trilha agora</strong>
          <span>{reason}</span>
        </div>
      </div>
      {trail.error !== 'quota' && trail.error !== 'tema' && (
        <button
          className="btn primary block"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onRetry()
            } catch {
              // segue na tela de falha
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Tentando…' : 'Tentar de novo'}
        </button>
      )}
      {catalog.length > 0 && (
        <section className="stack" aria-label="Trilhas prontas">
          <h2>Enquanto isso, uma trilha pronta</h2>
          {catalog.map((c) => (
            <button
              key={c.trail_id}
              className="btn block"
              style={{ justifyContent: 'flex-start' }}
              onClick={async () => {
                await post(`/trails/${c.trail_id}/start`).catch(() => {})
                navigate(`/trilha/${c.trail_id}`, { replace: true })
              }}
            >
              {c.title}
            </button>
          ))}
        </section>
      )}
      <Link className="btn ghost block" to="/aprender">Escolher outro tema</Link>
    </main>
  )
}

function Ready({ trail, onChange }: { trail: Trail; onChange: (t: Trail) => void }) {
  const wide = useWide()
  const done = trail.parts.filter((p) => p.done).length
  const studying = loadTimer()?.partId
  const firstOpen = trail.parts.find((p) => p.id === studying)?.id ?? trail.parts.find((p) => !p.done)?.id ?? trail.parts[0]?.id
  const [open, setOpen] = useState<number | undefined>(firstOpen)
  // O disco da trilha é o do tema dela (cores da capa e nível).
  const { data: topics } = useApi<Topic[]>('/topics?sort=recent')
  const owner = topics?.find((t) => t.trail_id === trail.id)
  const disc = { palette: owner?.palette ?? ('noite' as const), level: owner?.level.name }
  const markDone = (id: number) =>
    onChange({ ...trail, parts: trail.parts.map((p) => (p.id === id ? { ...p, done: true } : p)) })

  const header = (
    <div className="page-head">
      {topics && (
        <BackLink className="muted small back-link" to={owner ? `/tema/${owner.id}` : '/'}>
          ‹ {owner ? 'Disco' : 'Estante'}
        </BackLink>
      )}
      <span className="muted small" style={{ fontWeight: 700, letterSpacing: '0.06em' }}>LADO A · TRILHA</span>
      <div className="row spread" style={{ alignItems: 'center' }}>
        <h1>{trail.title}</h1>
        <AssistantPanel topic={trail.title} />
      </div>
      <div className="row" style={{ marginTop: 'var(--space-2)' }}>
        <div className="bar grow" aria-hidden>
          <span style={{ width: `${trail.parts.length ? (done / trail.parts.length) * 100 : 0}%` }} />
        </div>
        <span className="muted small">{done} de {trail.parts.length} faixas</span>
      </div>
    </div>
  )

  if (wide) {
    const selected = trail.parts.find((p) => p.id === open) ?? trail.parts[0]
    return (
      <main className="shell">
        {header}
        <div className="trail-layout">
          <nav className="trail-parts" aria-label="Partes da trilha">
            {trail.parts.map((part) => (
              <PartHead
                key={part.id}
                part={part}
                open={selected?.id === part.id}
                onClick={() => setOpen(part.id)}
              />
            ))}
          </nav>
          <div className="trail-detail">
            {selected && (
              <section className="card part-card" key={selected.id}>
                <div className="part-body">
                  <div className="stack" style={{ gap: 'var(--space-1)' }}>
                    <span className="muted small">Faixa {String(selected.order).padStart(2, '0')}</span>
                    <h2>{selected.title}</h2>
                  </div>
                  <PartBody trail={trail} part={selected} disc={disc} onDone={() => markDone(selected.id)} onOpenPart={setOpen} />
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="shell">
      {header}
      <div className="trail-layout">
        {trail.parts.map((part) => (
          <section className="card part-card" key={part.id}>
            <PartHead part={part} open={open === part.id} onClick={() => setOpen(open === part.id ? undefined : part.id)} />
            {open === part.id && (
              <div className="part-body">
                <PartBody trail={trail} part={part} disc={disc} onDone={() => markDone(part.id)} onOpenPart={setOpen} />
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  )
}

function PartHead({ part, open, onClick }: { part: TrailPart; open: boolean; onClick: () => void }) {
  return (
    <button
      className={`part-head${open ? ' open' : ''}${part.done ? ' done' : ''}`}
      onClick={onClick}
      aria-expanded={open}
    >
      <span className="step-mark" aria-hidden="true">{part.done ? '✓' : part.order}</span>
      <span className="stack grow" style={{ gap: 0 }}>
        <span className="muted small">Faixa {String(part.order).padStart(2, '0')}{part.done ? ' · ouvida' : ''}</span>
        <strong style={{ fontWeight: 650 }}>{part.title}</strong>
      </span>
      <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  )
}

type Disc = { palette: PaletteName; level?: string }
type BodyProps = { trail: Trail; part: TrailPart; disc: Disc; onDone: () => void; onOpenPart: (id: number) => void }

function PartBody({ trail, part, disc, onDone, onOpenPart }: BodyProps) {
  const [playing, setPlaying] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const playerRef = useRef<HTMLDivElement>(null)

  const [goal, setGoal] = useState(25)
  const session = useSession({
    topic: trail.title,
    back: `/trilha/${trail.id}`,
    partId: part.id,
    palette: disc.palette,
    level: disc.level,
  })

  async function markDone() {
    setBusy(true)
    setMessage('')
    try {
      await post(`/parts/${part.id}/done`)
      onDone()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não deu para concluir.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {part.videos.length === 0 && (
        <p className="muted">Nenhuma aula encontrada para esta faixa. Você pode estudar com seu próprio material.</p>
      )}
      {playing && (
        <div ref={playerRef} className="player">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${playing}?autoplay=1`}
            title="Aula"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      )}
      {part.videos.length > 0 && (
        <ul className="video-list">
          {part.videos.map((v) => (
            <li key={v.youtube_id}>
              <button
                className="video-row"
                onClick={() => {
                  setPlaying(v.youtube_id)
                  requestAnimationFrame(() => playerRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
                }}
                aria-pressed={playing === v.youtube_id}
              >
                <img src={`https://i.ytimg.com/vi/${v.youtube_id}/mqdefault.jpg`} alt="" loading="lazy" width={128} height={72} />
                <span className="stack grow" style={{ gap: 2 }}>
                  <span className="video-title">{v.title}</span>
                  <span className="muted small">
                    {v.channel}{v.duration_s ? ` · ${duration(v.duration_s)}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="action-list">
        {session.mine ? (
          <RunningSession session={session} caption={`Faixa ${String(part.order).padStart(2, '0')} · ${part.title}`} />
        ) : session.other ? (
          <OtherSession
            timer={session.other}
            onOpen={session.other.back === `/trilha/${trail.id}` && session.other.partId ? () => onOpenPart(session.other!.partId!) : undefined}
          />
        ) : (
          <>
            <GoalChips value={goal} onChange={setGoal} />
            <button className="btn primary block" onClick={() => session.start(goal)}>
              {part.done ? 'Tocar de novo' : 'Tocar esta faixa'}
            </button>
          </>
        )}
        {part.done ? (
          <Link className="btn soft block" to={`/trilha/${trail.id}/parte/${part.id}/exercicios`}>
            Fazer exercícios
          </Link>
        ) : (
          <button className="btn soft block" onClick={markDone} disabled={busy}>
            {busy ? 'Salvando…' : 'Concluí esta faixa'}
          </button>
        )}
        {message && <p className="notice warn" role="alert">{message}</p>}
      </div>
    </>
  )
}
