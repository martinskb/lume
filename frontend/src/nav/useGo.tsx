import { useCallback, useEffect } from 'react'
import { Link, type LinkProps, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { currentIdx, loadStack, pathOf, recordVisit, saveStack, stepsBackTo } from './stack'

/** Fica na raiz do app e anota cada página visitada na posição do histórico. */
export function NavRecorder() {
  const { pathname } = useLocation()
  const action = useNavigationType()
  useEffect(() => {
    saveStack(recordVisit(loadStack(), currentIdx(), pathname, action))
  }, [pathname, action])
  return null
}

/**
 * Vai para `to`. Se a página já estiver atrás no histórico, volta até ela (igual ao botão
 * voltar do celular). Senão abre normalmente; `replace` troca a página atual.
 */
export function useGo() {
  const navigate = useNavigate()
  return useCallback(
    (to: string, options?: { replace?: boolean }) => {
      const steps = stepsBackTo(loadStack(), currentIdx(), pathOf(to))
      if (steps !== null) void navigate(steps)
      else void navigate(to, options)
    },
    [navigate],
  )
}

/**
 * Link de "voltar": volta no histórico quando dá; senão troca a página atual pelo destino
 * (ou abre por cima, com `push`, para links que não são de voltar, como a sessão em andamento).
 */
export function BackLink({ to, onClick, push = false, ...rest }: Omit<LinkProps, 'to'> & { to: string; push?: boolean }) {
  const go = useGo()
  return (
    <Link
      to={to}
      {...rest}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        go(to, { replace: !push })
      }}
    />
  )
}
