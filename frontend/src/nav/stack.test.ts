import { describe, expect, it } from 'vitest'
import { pathOf, recordVisit, stepsBackTo } from './stack'

describe('pilha de navegação', () => {
  it('guarda cada página na posição do histórico', () => {
    let s: (string | null)[] = []
    s = recordVisit(s, 0, '/', 'POP')
    s = recordVisit(s, 1, '/tema/5', 'PUSH')
    s = recordVisit(s, 2, '/trilha/9', 'PUSH')
    expect(s).toEqual(['/', '/tema/5', '/trilha/9'])
  })

  it('ao abrir página nova depois de voltar, esquece o que estava à frente', () => {
    let s: (string | null)[] = ['/', '/tema/5', '/trilha/9']
    s = recordVisit(s, 1, '/tema/5', 'POP') // voltou
    s = recordVisit(s, 2, '/progresso', 'PUSH')
    expect(s).toEqual(['/', '/tema/5', '/progresso'])
  })

  it('substituir troca só a posição atual', () => {
    const s = recordVisit(['/', '/aprender'], 1, '/trilha/3', 'REPLACE')
    expect(s).toEqual(['/', '/trilha/3'])
  })

  it('acha quantos passos voltar até o destino', () => {
    const s = ['/', '/tema/5', '/trilha/9', '/trilha/9/parte/2/exercicios']
    expect(stepsBackTo(s, 3, '/trilha/9')).toBe(-1)
    expect(stepsBackTo(s, 3, '/')).toBe(-3)
    expect(stepsBackTo(s, 1, '/trilha/9')).toBeNull() // está à frente, não atrás
    expect(stepsBackTo(s, 3, '/ranking')).toBeNull()
  })

  it('usa a ocorrência mais próxima', () => {
    expect(stepsBackTo(['/', '/tema/5', '/', '/tema/7'], 3, '/')).toBe(-1)
  })

  it('compara só o caminho, sem a busca', () => {
    expect(pathOf('/tema/5?tocar=1')).toBe('/tema/5')
    expect(pathOf('/')).toBe('/')
  })
})
