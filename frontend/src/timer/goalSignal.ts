import { type TimerState, activeSeconds } from './timerState'

const key = (clientId: string) => `goal-signal:${clientId}`

/** A sessão acabou de bater a meta e ainda não avisou? Marca o aviso (uma vez por sessão, mesmo recarregando). */
export function shouldSignalGoal(t: TimerState, now: number, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): boolean {
  if (t.pausedAt !== null || activeSeconds(t, now) < t.goalMinutes * 60) return false
  try {
    if (storage.getItem(key(t.clientId))) return false
    storage.setItem(key(t.clientId), '1')
  } catch {
    // armazenamento bloqueado: avisa assim mesmo (no máximo de novo depois de recarregar)
  }
  return true
}
