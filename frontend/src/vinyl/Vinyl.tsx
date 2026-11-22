import { type CSSProperties, useEffect, useState } from 'react'
import { PALETTES, type PaletteName } from '../topics/cover'
import { ARM_REST, armAngle, finishOf } from './vinyl'

type DiscProps = {
  palette: PaletteName
  level?: string
  /** true gira, false para onde está; sem valor, o disco nem tem animação. */
  spinning?: boolean
  className?: string
}

/** O disco do tema: acabamento pelo nível, rótulo nas cores da capa. */
export function Vinyl({ palette, level, spinning, className = '' }: DiscProps) {
  const p = PALETTES[palette] ?? PALETTES.indigo
  const motion = spinning === undefined ? '' : spinning ? ' turning' : ' turning stopped'
  return (
    <div
      className={`vinyl vinyl-${finishOf(level)}${motion} ${className}`}
      style={{ '--label': p.dark, '--label-ring': p.light } as CSSProperties}
      aria-hidden="true"
    >
      <span className="vinyl-label" />
    </div>
  )
}

type TurntableProps = {
  palette: PaletteName
  level?: string
  playing: boolean
  progress: number
  className?: string
  /** prato sem disco (estante do computador, antes de escolher um) */
  empty?: boolean
  /** false: o disco já chegou voando da estante, sem a descida padrão */
  arrive?: boolean
}

/** Toca-discos: o disco gira enquanto o cronômetro roda; o braço avança pelos sulcos até a meta. */
export function Turntable({ palette, level, playing, progress, className = '', empty = false, arrive = true }: TurntableProps) {
  // Ao aparecer, o disco desce no prato e só então o braço vai até ele.
  const [settled, setSettled] = useState(!arrive)
  useEffect(() => {
    if (!arrive) return
    const id = setTimeout(() => setSettled(true), 700)
    return () => clearTimeout(id)
  }, [arrive])
  const angle = playing && settled ? armAngle(progress, true) : ARM_REST
  return (
    <div className={`turntable${settled ? '' : ' arriving'} ${className}`} aria-hidden="true">
      <span className="tt-platter" />
      {/* marca onde o disco fica: é o alvo do disco que voa da estante */}
      <span className="tt-disc tt-slot" data-disc-slot />
      {!empty && <Vinyl palette={palette} level={level} spinning={playing} className="tt-disc" />}
      <span className="tt-pivot" />
      <span className="tt-arm" style={{ transform: `rotate(${angle}deg)` }}>
        <i className="tt-rod" />
        <i className="tt-head" />
      </span>
      <span className={`tt-led${playing ? ' on' : ''}`} />
    </div>
  )
}
