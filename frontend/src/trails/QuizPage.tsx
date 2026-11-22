import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { BackLink } from '../nav/useGo'
import { post } from '../api/client'
import type { AnswerResult, QuizQuestion } from '../api/types'
import { useApi } from '../api/useApi'
import { AiText } from '../text/LazyRichText'
import { PageSkeleton } from '../ui/Skeleton'
import { playSound } from '../ui/sound'

const LETTERS = ['A', 'B', 'C', 'D']

export function QuizPage() {
  const { id, partId } = useParams()
  const { data: questions, error, reload } = useApi<QuizQuestion[]>(`/parts/${partId}/quiz`)
  const [index, setIndex] = useState(0)
  const [choice, setChoice] = useState<number | null>(null)
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [hits, setHits] = useState(0)
  const [busy, setBusy] = useState(false)
  const [answerError, setAnswerError] = useState('')
  const back = `/trilha/${id}`

  const aiLabel = <p className="muted small">Gerado por IA — confira no seu material.</p>

  if (error) {
    return (
      <main className="shell narrow">
        <h1>Exercícios</h1>
        <div className="notice warn stack">
          <p>{error}</p>
          <button className="btn" onClick={reload}>Tentar de novo</button>
        </div>
        <BackLink className="btn ghost block" to={back}>Voltar à trilha</BackLink>
      </main>
    )
  }
  if (!questions) return <PageSkeleton variant="quiz" />

  if (questions.length === 0) {
    return (
      <main className="shell narrow">
        <h1>Exercícios</h1>
        <p className="muted">Ainda não há exercícios para esta parte.</p>
        <BackLink className="btn block" to={back}>Voltar à trilha</BackLink>
      </main>
    )
  }

  if (index >= questions.length) {
    return (
      <main className="shell narrow center" style={{ justifyContent: 'center' }}>
        <div className="stack center pop">
          <p className="muted">Fixação concluída</p>
          <div className="big-number">{hits}<span className="muted"> / {questions.length}</span></div>
          <p>{hits === questions.length ? 'Acertou tudo!' : 'Vale rever o que errou na aula.'}</p>
          <p className="muted small">Exercícios não valem pontos: é só para fixar.</p>
        </div>
        <BackLink className="btn primary block" to={back}>Voltar à trilha</BackLink>
      </main>
    )
  }

  const q = questions[index]

  async function answer(option: number) {
    if (busy || result) return
    setChoice(option)
    setBusy(true)
    setAnswerError('')
    try {
      const r = await post<AnswerResult>(`/exercises/${q.id}/answer`, { choice: option })
      setResult(r)
      playSound(r.correct ? 'right' : 'wrong')
      if (r.correct) setHits((h) => h + 1)
    } catch (err) {
      setChoice(null)
      setAnswerError(err instanceof Error ? err.message : 'Não deu para enviar a resposta.')
    } finally {
      setBusy(false)
    }
  }

  function next() {
    setIndex((i) => i + 1)
    setChoice(null)
    setResult(null)
  }

  return (
    <main className="shell narrow">
      <div className="row spread">
        <h1>Exercícios</h1>
        <span className="muted">{index + 1} de {questions.length}</span>
      </div>
      <div className="bar" aria-hidden><span style={{ width: `${(index / questions.length) * 100}%` }} /></div>

      <section className="card stack">
        <p style={{ fontWeight: 600 }}><AiText text={q.question} inline /></p>
        <div className="stack" role="group" aria-label="Alternativas">
          {q.options.map((option, i) => {
            const state = !result ? '' : i === result.correct_index ? 'right' : i === choice ? 'wrong' : ''
            return (
              <button
                key={i}
                className={`btn block option ${state}`}
                disabled={busy || result !== null}
                onClick={() => answer(i)}
              >
                <span className="option-letter">{LETTERS[i]}</span>
                <span className="grow"><AiText text={option} inline /></span>
              </button>
            )
          })}
        </div>
        {answerError && <p className="error" role="alert">{answerError}</p>}
        {result && (
          <div className={`notice ${result.correct ? '' : 'warn'} stack`} role="status">
            <strong>{result.correct ? 'Certo!' : `Não foi dessa vez. A resposta é a ${LETTERS[result.correct_index]}.`}</strong>
            {result.explanation && <AiText text={result.explanation} inline />}
          </div>
        )}
        {aiLabel}
      </section>

      {result && (
        <button className="btn primary block" onClick={next}>
          {index + 1 === questions.length ? 'Ver resultado' : 'Próxima'}
        </button>
      )}
      <BackLink className="btn ghost block" to={back}>Sair dos exercícios</BackLink>
    </main>
  )
}
