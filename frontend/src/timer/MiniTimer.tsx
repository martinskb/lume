import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { BackLink } from '../nav/useGo'
import { Vinyl } from '../vinyl/Vinyl'
import { activeSeconds, backOf, loadTimer } from './timerState'
import { clock } from './useSession'

/** "Tocando agora": o disco da sessão em andamento fora da tela dela; leva de volta ao tema ou à trilha. */
export function MiniTimer() {
  const { pathname } = useLocation()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const timer = loadTimer()
  if (!timer || pathname === '/concluir' || pathname === backOf(timer)) return null

  const paused = timer.pausedAt !== null
  const seconds = activeSeconds(timer, now)
  const met = seconds >= timer.goalMinutes * 60
  return (
    // Na Estante do computador o toca-discos já mostra a sessão: a faixa some lá (on-shelf).
    <BackLink push className={`mini-timer${pathname === '/' ? ' on-shelf' : ''}`} to={backOf(timer)}>
      <Vinyl palette={timer.palette ?? 'noite'} level={timer.level} spinning={!paused} className="mini-disc" />
      <span className="stack grow" style={{ gap: 0, minWidth: 0 }}>
        <span className={`mini-label${met ? ' lit' : ''}`}>{paused ? 'Pausado' : met ? 'Meta cumprida!' : 'Tocando agora'}</span>
        <strong className="truncate">{timer.topic}</strong>
      </span>
      <strong className="mini-clock">{clock(seconds)}</strong>
    </BackLink>
  )
}
