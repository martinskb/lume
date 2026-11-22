import type { ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { pathOf } from './nav/stack'
import { NavRecorder, useGo } from './nav/useGo'
import { LoginPage } from './auth/LoginPage'
import { Logo } from './brand/Logo'
import { getNickname, getToken } from './auth/auth'
import { HomePage } from './home/HomePage'
import { ProfilePage } from './profile/ProfilePage'
import { Avatar } from './ui/Avatar'
import { ProgressPage } from './progress/ProgressPage'
import { RankingPage } from './ranking/RankingPage'
import { FinishPage } from './timer/FinishPage'
import { MiniTimer } from './timer/MiniTimer'
import { StudyMusicSync } from './timer/StudyMusicSync'
import { GoalSignal } from './timer/GoalSignal'
import { DuotoneFilters } from './topics/DuotoneFilters'
import { TopicPage } from './topics/TopicPage'
import { NewTrailPage } from './trails/NewTrailPage'
import { QuizPage } from './trails/QuizPage'
import { TrailPage } from './trails/TrailPage'

const ICONS = {
  shelf: 'M4 20V9M9 20V5M14 20V9M19 20V12M2 20h20',
  chart: 'M5 20V12M10 20V7M15 20v-5M20 20V4',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M9 20h6M10 17h4',
}

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

const TABS = ['/progresso', '/ranking', '/perfil']

/**
 * Aba da barra. Trocar de uma aba para outra não empilha (o voltar do celular sai da aba
 * para onde a pessoa estava antes), e "Estante" volta até ela se ela já estiver atrás.
 */
function Tab({ to, className, end, children }: { to: string; className?: string; end?: boolean; children: ReactNode }) {
  const { pathname } = useLocation()
  const go = useGo()
  return (
    <NavLink
      to={to}
      end={end}
      className={className}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        go(to, { replace: TABS.includes(pathname) || pathname === pathOf(to) })
      }}
    >
      {children}
    </NavLink>
  )
}

/** Cada troca de tela remonta o conteúdo, e ele entra com uma animação curta. */
export function Page() {
  const { pathname } = useLocation()
  return (
    <div className="page" key={pathname}>
      <Outlet />
    </div>
  )
}

function Private() {
  if (!getToken()) return <Navigate to="/entrar" replace />
  return (
    <>
      <nav className="nav" aria-label="Principal">
        <div className="nav-brand"><Logo size={32} /></div>
        <div className="nav-links">
          <Tab to="/" end><Icon path={ICONS.shelf} />Estante</Tab>
          <Tab to="/progresso"><Icon path={ICONS.chart} />Progresso</Tab>
          <Link className="nav-add" to="/?novo=1" aria-label="Novo tema">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </Link>
          <Tab to="/ranking"><Icon path={ICONS.trophy} />Ranking</Tab>
          <Tab to="/perfil" className="nav-profile"><Avatar nickname={getNickname() ?? '?'} size={26} /><span>Perfil</span></Tab>
        </div>
      </nav>
      <div className="app-main">
        <Page />
      </div>
      <MiniTimer />
      <StudyMusicSync />
      <GoalSignal />
      <DuotoneFilters />
    </>
  )
}

export default function App() {
  return (
    <>
    <NavRecorder />
    <Routes>
      <Route element={<Page />}>
        <Route path="/entrar" element={<LoginPage />} />
      </Route>
      <Route element={<Private />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/concluir" element={<FinishPage />} />
        <Route path="/progresso" element={<ProgressPage />} />
        <Route path="/ranking" element={<RankingPage />} />
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="/tema/:id" element={<TopicPage />} />
        <Route path="/aprender" element={<NewTrailPage />} />
        <Route path="/trilha/:id" element={<TrailPage />} />
        <Route path="/trilha/:id/parte/:partId/exercicios" element={<QuizPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
