/**
 * O disco sai da capa na estante e voa até o prato do toca-discos (computador).
 * Voa uma cópia por cima da página; quem chama troca pelo disco de verdade e depois
 * chama a função devolvida para tirar a cópia (assim não pisca).
 */
export async function flyDisc(from: HTMLElement, to: HTMLElement): Promise<() => void> {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  const a = from.getBoundingClientRect()
  const b = to.getBoundingClientRect() // o prato está inclinado: é a elipse vista de cima
  const clone = from.cloneNode(true) as HTMLElement
  clone.classList.remove('sleeve-disc')
  Object.assign(clone.style, {
    position: 'fixed', left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`,
    margin: '0', zIndex: '80', pointerEvents: 'none', transformOrigin: '0 0',
    boxShadow: '0 18px 30px rgba(0, 0, 0, 0.45)',
  })
  document.body.appendChild(clone)
  from.style.visibility = 'hidden'

  const dx = b.left - a.left
  const dy = b.top - a.top
  const lift = Math.min(a.top, b.top) - a.top - 90 // sobe num arco antes de descer no prato
  const sx = b.width / a.width
  const sy = b.height / a.height
  const flight = clone.animate(
    [
      { transform: 'translate(0, 0) scale(1) rotate(0deg)' },
      { transform: `translate(${a.width * 0.55}px, ${-a.height * 0.08}px) scale(1) rotate(40deg)`, offset: 0.25 },
      { transform: `translate(${dx * 0.6}px, ${lift}px) scale(${(1 + sx) / 2}, ${(1 + sy) / 2}) rotate(220deg)`, offset: 0.65 },
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotate(360deg)`, boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)' },
    ],
    { duration: 950, easing: 'cubic-bezier(0.45, 0.05, 0.25, 1)', fill: 'forwards' },
  )
  try {
    await flight.finished
  } catch {
    // animação cancelada (saiu da página): só limpa
  }
  return () => {
    clone.remove()
    from.style.visibility = ''
  }
}
