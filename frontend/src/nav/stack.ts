/**
 * Continuidade entre o "voltar" do site e o do celular.
 *
 * Guardamos qual página está em cada posição do histórico do navegador. Quando um link
 * do site leva a uma página que já está atrás (ex.: "‹ Estante" dentro de um disco),
 * voltamos no histórico em vez de empilhar a página de novo. Assim o botão voltar do
 * celular faz sempre o mesmo caminho que os botões do site.
 */
export type NavAction = 'PUSH' | 'POP' | 'REPLACE'
type Stack = (string | null)[]

const KEY = 'lume.navStack'

export const pathOf = (to: string) => to.split(/[?#]/)[0] || '/'

export function recordVisit(stack: Stack, idx: number, path: string, action: NavAction): Stack {
  const next = action === 'PUSH' ? stack.slice(0, idx) : stack.slice()
  while (next.length < idx) next.push(null)
  next[idx] = path
  return next
}

/** Passos (negativos) até `path` atrás da posição atual, ou null se não estiver atrás. */
export function stepsBackTo(stack: Stack, idx: number, path: string): number | null {
  for (let j = Math.min(idx, stack.length) - 1; j >= 0; j--) {
    if (stack[j] === path) return j - idx
  }
  return null
}

/** Posição atual no histórico (o react-router guarda `idx` em history.state). */
export function currentIdx(): number {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx
  return typeof idx === 'number' ? idx : 0
}

export function loadStack(): Stack {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function saveStack(stack: Stack) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stack))
  } catch {
    // sem armazenamento: os links abrem páginas novas, como antes
  }
}
