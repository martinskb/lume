import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, post } from '../api/client'
import type { CatalogItem } from '../api/types'

const LEVELS = [
  { value: 'livre', label: 'Curiosidade', hint: 'cultura pop, atualidades, hobbies' },
  { value: 'academico', label: 'Acadêmico', hint: 'escola, ENEM e faculdade' },
]

export function NewTrailPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [topic, setTopic] = useState(params.get('tema') ?? '')
  const [level, setLevel] = useState('livre')
  const [suggestions, setSuggestions] = useState<CatalogItem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const query = topic.trim()

  // Sugestões do catálogo enquanto digita (ou os temas populares, com o campo vazio).
  useEffect(() => {
    let cancelled = false
    const id = setTimeout(
      () => {
        api<CatalogItem[]>(`/catalog?q=${encodeURIComponent(query)}`)
          .then((items) => !cancelled && setSuggestions(items))
          .catch(() => !cancelled && setSuggestions([]))
      },
      query ? 300 : 0,
    )
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [query])

  async function open(action: () => Promise<number>) {
    setBusy(true)
    setError('')
    try {
      navigate(`/trilha/${await action()}`, { replace: true }) // o formulário não fica atrás da trilha
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu para abrir a trilha.')
      setBusy(false)
    }
  }

  const create = (e: FormEvent) => {
    e.preventDefault()
    void open(async () => (await post<{ trail_id: number }>('/trails', { topic: query, level })).trail_id)
  }

  const pick = (item: CatalogItem) =>
    open(async () => {
      await post(`/trails/${item.trail_id}/start`)
      return item.trail_id
    })

  return (
    <main className="shell narrow">
      <div className="stack">
        <h1>O que você quer aprender?</h1>
        <p className="muted">
          O Lume divide em degraus e acha os melhores vídeos gratuitos.
        </p>
      </div>

      <form className="card stack" onSubmit={create}>
        <label>
          Tema
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={120}
            placeholder="ex.: Fotossíntese, SQL básico, Cronologia da Marvel"
            autoFocus
          />
        </label>
        <fieldset>
          <legend>Para quê?</legend>
          <div className="segmented" role="radiogroup" aria-label="Para quê?">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                role="radio"
                aria-checked={level === l.value}
                onClick={() => setLevel(l.value)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <span className="muted small" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
            {LEVELS.find((l) => l.value === level)?.hint}
          </span>
        </fieldset>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary block" disabled={query.length < 3 || busy}>
          {busy ? 'Abrindo…' : 'Montar trilha'}
        </button>
      </form>

      {suggestions.length > 0 && (
        <section className="stack" aria-label="Trilhas prontas">
          <h2>{query ? 'Já existe trilha pronta' : 'Temas populares'}</h2>
          {suggestions.map((s) => (
            <button
              key={s.trail_id}
              className="btn block"
              style={{ justifyContent: 'flex-start' }}
              disabled={busy}
              onClick={() => pick(s)}
            >
              {s.title}
            </button>
          ))}
        </section>
      )}
    </main>
  )
}
