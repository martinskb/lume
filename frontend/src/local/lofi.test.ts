import { describe, expect, it } from 'vitest'
import { PENTATONIC, PROGRESSIONS, composeBar, midiToHz } from './lofi'

const seq = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

describe('lofi do Lume', () => {
  it('lá 440', () => {
    expect(midiToHz(69)).toBe(440)
    expect(midiToHz(81)).toBeCloseTo(880)
  })

  it('cada compasso segue a progressão, em loop de 4', () => {
    const prog = PROGRESSIONS[0]
    for (let n = 0; n < 8; n++) expect(composeBar(n, 0, seq(0.9)).chord).toBe(prog[n % 4])
  })

  it('a melodia só usa a pentatônica e cai dentro do compasso', () => {
    for (let n = 0; n < 50; n++) {
      for (const m of composeBar(n, n, Math.random).melody) {
        expect(PENTATONIC).toContain(m.note)
        expect(m.beat).toBeGreaterThanOrEqual(0)
        expect(m.beat).toBeLessThan(4)
      }
    }
  })

  it('de tempos em tempos a bateria some por 4 compassos', () => {
    const drums = Array.from({ length: 32 }, (_, n) => composeBar(n, 0, seq(0.9)).drums)
    expect(drums.slice(24, 28)).toEqual([false, false, false, false])
    expect(drums.filter(Boolean)).toHaveLength(28)
  })
})
