import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BackLink, useGo } from '../nav/useGo'
import { api, post } from '../api/client'
import type { Topic, TopicDetail } from '../api/types'
import { useApi } from '../api/useApi'
import { GoalChips, OtherSession, RunningSession } from '../timer/Session'
import { Vinyl } from '../vinyl/Vinyl'
import { useSession } from '../timer/useSession'
import { AssistantPanel } from '../assistant/AssistantPanel'
import { ConfirmButton } from '../ui/ConfirmButton'
import { PageSkeleton } from '../ui/Skeleton'
import { removeCover, saveCover, useAdoptServerCovers, useDeviceCover } from '../local/covers'
import { Sleeve } from './Cover'
import { PALETTES, type PaletteName, formatHours, photoToCover } from './cover'

const dayLabel = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}

export function TopicPage() {
  const { id } = useParams()
  const go = useGo()
  const { data: topic, error, setData } = useApi<TopicDetail>(`/topics/${id}`)
  const [editing, setEditing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [makingTrail, setMakingTrail] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [goal, setGoal] = useState(25)
  const session = useSession({
    topic: topic?.title ?? '',
    back: `/tema/${id}`,
    topicId: Number(id),
    palette: topic?.palette,
    level: topic?.level.name,
  })
  const photoRef = useRef<HTMLInputElement>(null)
  const devicePhoto = useDeviceCover(Number(id))
  useAdoptServerCovers(useMemo(() => (topic ? [topic] : null), [topic]))

  // "Tocar 25 min" do menu do álbum na estante: abre o tema já tocando.
  const [params, setParams] = useSearchParams()
  const autoplay = params.get('tocar') === '1'
  const { start, mine, other } = session
  useEffect(() => {
    if (!autoplay || !topic) return
    if (!mine && !other) start(25)
    setParams({}, { replace: true })
  }, [autoplay, topic, mine, other, start, setParams])

  if (error) {
    return (
      <main className="shell narrow">
        <p className="error" role="alert">{error}</p>
        {session.mine && <Link className="btn primary block" to="/concluir">Ver sessão em andamento</Link>}
        <BackLink className="btn block" to="/">Voltar à estante</BackLink>
      </main>
    )
  }
  if (!topic) return <PageSkeleton variant="topic" />

  async function choosePhoto(file: File | undefined) {
    if (!file || !topic) return
    setUploading(true)
    setPhotoError('')
    try {
      await saveCover(topic.id, await photoToCover(file))
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Não deu para usar essa foto.')
    } finally {
      setUploading(false)
      if (photoRef.current) photoRef.current.value = ''
    }
  }

  const lv = topic.level
  const trail = topic.trail
  const hasPhoto = Boolean(devicePhoto || topic.cover)

  // Tocando: a página do tema vira o modo foco (toca-discos, relógio e controles).
  if (session.mine) {
    return (
      <main className="shell narrow focus-page scene">
        <div className="scene-bg" aria-hidden="true" />
        <div className="focus-top">
          <BackLink className="muted small back-link" to="/">‹ Estante</BackLink>
          <AssistantPanel topic={topic.title} />
        </div>
        <RunningSession session={session} caption={topic.title} />
      </main>
    )
  }

  return (
    <main className="shell">
      <BackLink className="muted small back-link" to="/">‹ Estante</BackLink>

      <section className="topic-hero">
        <div className="cover-wrap">
          <Sleeve topic={topic} size="hero" showTitle={false} />
          <button
            className={`cover-photo-btn${hasPhoto ? '' : ' empty'}`}
            onClick={() => photoRef.current?.click()}
            disabled={uploading}
            aria-label={hasPhoto ? 'Trocar foto da capa' : 'Adicionar foto à capa'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            {uploading ? 'Enviando…' : null}
          </button>
          <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => choosePhoto(e.target.files?.[0])} />
        </div>
        <div className="stack" style={{ gap: 'var(--space-4)' }}>
          <div className="stack" style={{ gap: 'var(--space-2)' }}>
            <h1>{topic.title}</h1>
            <p className="muted small">
              {formatHours(topic.total_seconds)} focadas · {topic.sessions} {topic.sessions === 1 ? 'sessão' : 'sessões'}
              {topic.streak > 0 && ` · ${topic.streak} ${topic.streak === 1 ? 'dia seguido' : 'dias seguidos'}`}
            </p>
            <div className="level-row" aria-label={`Disco ${lv.name}`}>
              <Vinyl palette={topic.palette} level={lv.name} className="level-disc" />
              <div className="bar grow" aria-hidden><span style={{ width: `${Math.round(lv.progress * 100)}%` }} /></div>
              <span className="muted small">{lv.next_name ? `${lv.next_name} em ${formatHours(lv.seconds_to_next)}` : 'Diamante!'}</span>
            </div>
          </div>
          {session.other ? (
            <OtherSession timer={session.other} />
          ) : (
            <div className="play-row">
              <button className="play" onClick={() => session.start(goal)} aria-label={`Tocar ${goal} ${goal === 1 ? "minuto" : "minutos"} de ${topic.title}`}>
                <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5 19.5 12 7 19.5Z" fill="currentColor" /></svg>
              </button>
              <div className="stack" style={{ gap: 'var(--space-2)', minWidth: 0 }}>
                <strong>Tocar {goal} min</strong>
                <GoalChips value={goal} onChange={setGoal} />
              </div>
            </div>
          )}
          <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
            {trail ? (
              <Link className="btn soft small" to={`/trilha/${trail.id}`}>
                {trail.next_part ? `Lado A · continuar faixa ${String(trail.next_part).padStart(2, '0')}` : 'Lado A · ouvido inteiro'}
              </Link>
            ) : (
              <button className="btn soft small" onClick={() => setMakingTrail((m) => !m)} aria-expanded={makingTrail}>
                Montar trilha com vídeos
              </button>
            )}
            <button className="btn ghost small" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
              Editar tema
            </button>
          </div>
        </div>
      </section>

      {photoError && <p className="error" role="alert">{photoError}</p>}

      {makingTrail && !trail && <TrailMaker title={topic.title} onCancel={() => setMakingTrail(false)} />}

      {editing && (
        <CoverEditor
          topic={topic}
          onSaved={(t) => setData({ ...topic, ...t })}
          onDeleted={() => go('/', { replace: true })}
          onClose={() => setEditing(false)}
        />
      )}

      <section className="card stack" style={{ gap: 'var(--space-4)' }} aria-label="Sessões">
        <h2>Sessões</h2>
        {topic.tracks.length === 0 ? (
          <p className="muted">Nenhuma sessão ainda. Aperte o play para começar.</p>
        ) : (
          <ol className="tracks">
            {topic.tracks.map((t, i) => (
              <li key={t.id}>
                <span className="n">{String(i + 1).padStart(2, '0')}</span>
                <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                  <span className="truncate" style={{ fontWeight: 600 }}>{t.note || dayLabel(t.day)}</span>
                  <span className="muted small">
                    {t.note ? `${dayLabel(t.day)} · ` : ''}{t.goal_met ? 'meta cumprida' : `meta de ${t.goal_minutes} min`}
                  </span>
                </span>
                <strong className="small" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatHours(t.active_seconds)}</strong>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  )
}

type EditorProps = { topic: TopicDetail; onSaved: (t: Topic) => void; onDeleted: () => void; onClose: () => void }

function CoverEditor({ topic, onSaved, onDeleted, onClose }: EditorProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState(topic.title)
  const fileRef = useRef<HTMLInputElement>(null)

  async function patch(body: Record<string, unknown>) {
    setBusy(true)
    setError('')
    try {
      onSaved(await api<Topic>(`/topics/${topic.id}`, { method: 'PATCH', body: JSON.stringify(body) }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu para salvar.')
    } finally {
      setBusy(false)
    }
  }

  const photo = useDeviceCover(topic.id) ?? topic.cover

  async function pickPhoto(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      await saveCover(topic.id, await photoToCover(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu para usar essa foto.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await api(`/topics/${topic.id}`, { method: 'DELETE' })
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu para apagar.')
      setBusy(false)
    }
  }

  return (
    <section className="card stack" style={{ gap: 'var(--space-5)' }} aria-label="Editar tema">
      <div className="section-title">
        <h2>Editar tema</h2>
        <button className="btn ghost small" onClick={onClose}>Fechar</button>
      </div>

      <div className="stack" style={{ gap: 'var(--space-3)' }}>
        <span className="small" style={{ fontWeight: 600 }}>Foto</span>
        <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
          <button className="btn soft small" disabled={busy} onClick={() => fileRef.current?.click()}>
            {photo ? 'Trocar foto' : 'Escolher foto'}
          </button>
          {photo && (
            <button className="btn ghost small" disabled={busy} onClick={() => void removeCover(topic.id)}>Tirar foto</button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
        </div>
        <span className="muted small">A foto fica só neste aparelho.</span>
      </div>

      <div className="stack" style={{ gap: 'var(--space-3)' }}>
        <span className="small" style={{ fontWeight: 600 }} id="palette-label">Paleta</span>
        <div className="palette-chips" role="radiogroup" aria-labelledby="palette-label">
          {(Object.keys(PALETTES) as PaletteName[]).map((name) => (
            <button
              key={name}
              role="radio"
              aria-checked={topic.palette === name}
              aria-label={PALETTES[name].label}
              title={PALETTES[name].label}
              className="palette-chip"
              style={{ '--a': PALETTES[name].dark, '--b': PALETTES[name].light } as CSSProperties}
              disabled={busy}
              onClick={() => patch({ palette: name })}
            />
          ))}
        </div>
      </div>

      <form
        className="row"
        style={{ alignItems: 'flex-end' }}
        onSubmit={(e) => {
          e.preventDefault()
          if (title.trim() && title.trim() !== topic.title) void patch({ title: title.trim() })
        }}
      >
        <label className="grow">
          Nome do tema
          <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <button className="btn soft" disabled={busy || !title.trim() || title.trim() === topic.title}>Salvar</button>
      </form>

      <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
        <button className="btn ghost small" disabled={busy} onClick={() => patch({ done: !topic.done })}>
          {topic.done ? 'Voltar a aprender' : 'Marcar como concluído'}
        </button>
        <ConfirmButton
          className="btn ghost small"
          label="Tirar da galeria"
          confirmLabel="Tirar? Suas sessões continuam valendo"
          disabled={busy}
          onConfirm={remove}
        />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}

const KINDS = [
  { value: 'livre', label: 'Curiosidade' },
  { value: 'academico', label: 'Acadêmico' },
] as const

/** Monta a trilha do próprio tema: só pergunta o tipo, o tema já se sabe. */
function TrailMaker({ title, onCancel }: { title: string; onCancel: () => void }) {
  const navigate = useNavigate()
  const [kind, setKind] = useState<(typeof KINDS)[number]['value']>('livre')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function make() {
    setBusy(true)
    setError('')
    try {
      const r = await post<{ trail_id: number }>('/trails', { topic: title, level: kind })
      navigate(`/trilha/${r.trail_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu para montar a trilha agora.')
      setBusy(false)
    }
  }

  return (
    <section className="card stack" style={{ gap: 'var(--space-4)' }} aria-label="Montar trilha com vídeos">
      <div className="segmented" role="radiogroup" aria-label="Tipo de trilha">
        {KINDS.map((k) => (
          <button key={k.value} type="button" role="radio" aria-checked={kind === k.value} onClick={() => setKind(k.value)}>
            {k.label}
          </button>
        ))}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button className="btn primary grow" onClick={make} disabled={busy}>{busy ? 'Montando…' : 'Montar trilha'}</button>
        <button className="btn ghost" onClick={onCancel} disabled={busy}>Cancelar</button>
      </div>
    </section>
  )
}
