import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useGo } from '../nav/useGo'
import { post } from '../api/client'
import type { Conclusion } from '../api/types'
import { ConfirmButton } from '../ui/ConfirmButton'
import type { PaletteName } from '../topics/cover'
import { Celebration } from './Celebration'
import { clock } from './useSession'
import { type TimerState, activeSeconds, backOf, loadTimer, pause, resume, saveTimer } from './timerState'

type Disc = { title: string; palette: PaletteName; level?: string }

const backLabel = (back: string) =>
  back.startsWith('/tema/') ? 'Voltar ao tema' : back.startsWith('/trilha/') ? 'Voltar à trilha' : 'Voltar à estante'

/** Resumo da sessão: anotação opcional, salvar e comemorar. */
export function FinishPage() {
  const go = useGo()
  // Congela o tempo ao abrir o resumo (quem vem do botão Concluir já chega pausado).
  const [timer, setTimerState] = useState<TimerState | null>(() => {
    const t = loadTimer()
    return t && pause(t, Date.now())
  })
  const [now] = useState(() => Date.now())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ result: Conclusion; minutes: number; back: string; disc: Disc } | null>(null)

  if (done) {
    return <Celebration result={done.result} minutes={done.minutes} backTo={done.back} backLabel={backLabel(done.back)} disc={done.disc} />
  }
  if (!timer) return <Navigate to="/" replace />

  const frozen = timer
  // Sessão sem tela de origem: o resumo é o único lugar dela, então volta ao Início.
  const home = backOf(frozen) === '/concluir' ? '/' : backOf(frozen)
  const seconds = activeSeconds(frozen, now)

  async function conclude() {
    if (busy) return
    saveTimer(frozen)
    setTimerState(frozen)
    setBusy(true)
    setError('')
    try {
      const result = await post<Conclusion>('/sessions', {
        client_id: frozen.clientId,
        topic: frozen.topic,
        part_id: frozen.partId,
        topic_id: frozen.topicId ?? null,
        goal_minutes: frozen.goalMinutes,
        started_at: new Date(frozen.startedAt).toISOString(),
        ended_at: new Date(frozen.pausedAt!).toISOString(),
        active_seconds: seconds,
        note: note.trim() || null,
      })
      saveTimer(null)
      setDone({ result, minutes: Math.floor(seconds / 60), back: home, disc: { title: frozen.topic, palette: frozen.palette ?? 'noite', level: frozen.level } })
    } catch (err) {
      // O cronômetro continua salvo e pausado: dá para tentar de novo sem perder nada.
      setError(err instanceof Error ? err.message : 'Não deu para salvar a sessão.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="shell narrow">
      <h1>Concluir sessão</h1>
      <div className="card stack">
        <div className="row spread"><span>{timer.topic}</span><strong>{clock(seconds)}</strong></div>
        <label>
          Anotação (opcional)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="O que você estudou? Onde parou?"
          />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary block" onClick={conclude} disabled={busy}>
          {busy ? 'Salvando…' : error ? 'Tentar de novo' : 'Salvar sessão'}
        </button>
        {home !== '/' && (
          <button
            className="btn ghost block"
            disabled={busy}
            onClick={() => {
              saveTimer(resume(frozen, Date.now()))
              go(home)
            }}
          >
            Continuar estudando
          </button>
        )}
        <ConfirmButton
          label="Descartar"
          confirmLabel={`Descartar ${Math.floor(seconds / 60)} min?`}
          skipConfirm={seconds < 60}
          disabled={busy}
          onConfirm={() => {
            saveTimer(null)
            go(home, { replace: true })
          }}
        />
      </div>
    </main>
  )
}
