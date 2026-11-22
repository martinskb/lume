/**
 * Lofi do Lume: música calma gerada na hora (Web Audio), para quem não escolheu músicas.
 * Não tem fim nem arquivo para baixar: acordes de piano elétrico, baixo, batida leve com
 * swing, uma melodia esparsa e o chiado do vinil. A cada 8 compassos muda a progressão.
 */

// ---------- a música (funções puras, dá para testar) ----------
export const BPM = 72
const BEAT = 60 / BPM

/** Acordes em MIDI: [baixo, ...vozes]. Tudo em dó maior para a melodia pentatônica caber. */
export const PROGRESSIONS: number[][][] = [
  // Dm9 – G13 – Cmaj9 – Am9
  [[38, 53, 57, 60, 64], [43, 53, 59, 64, 69], [36, 52, 55, 59, 62], [45, 55, 60, 64, 67]],
  // Fmaj7 – Em7 – Dm7 – Cmaj7
  [[41, 57, 60, 64, 65], [40, 55, 59, 62, 67], [38, 57, 60, 62, 65], [36, 55, 59, 60, 64]],
  // Fmaj9 – G6 – Em7 – Am7
  [[41, 57, 60, 64, 67], [43, 59, 62, 64, 67], [40, 55, 59, 62, 64], [45, 55, 60, 64, 67]],
]
export const PENTATONIC = [72, 74, 76, 79, 81, 84]

export const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12)

export type Bar = {
  chord: number[]
  drums: boolean
  /** batidas (0–3.x) */
  kicks: number[]
  melody: { beat: number; note: number }[]
}

/** Monta o compasso `n` (0, 1, 2…). `random` entra como parâmetro para dar para testar. */
export function composeBar(n: number, progression: number, random: () => number = Math.random): Bar {
  const prog = PROGRESSIONS[progression % PROGRESSIONS.length]
  const section = Math.floor(n / 8)
  const drums = section % 4 !== 3 || n % 8 >= 4 // a cada 32 compassos, metade de um trecho sem bateria
  const kicks = random() < 0.35 ? [0, 1.75, 2.5] : [0, 2.5]
  const melody: Bar['melody'] = []
  for (let beat = 0; beat < 4; beat += 0.5) {
    if (random() < (beat % 1 === 0 ? 0.22 : 0.1)) {
      melody.push({ beat, note: PENTATONIC[Math.floor(random() * PENTATONIC.length)] })
    }
  }
  return { chord: prog[n % prog.length], drums, kicks, melody }
}

// ---------- o som ----------
const LOOKAHEAD_S = 2.5 // agenda com folga: em aba de fundo o navegador acorda o timer só 1×/s
const TICK_MS = 250

class Lofi {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bus: GainNode | null = null
  private wobble: GainNode | null = null
  private noise: AudioBuffer | null = null
  private crackle: AudioBufferSourceNode | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private nextBarAt = 0
  private bar = 0
  private progression = 0

  get playing() {
    return this.timer !== null
  }

  private setup(): AudioContext | null {
    if (this.ctx) return this.ctx
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    const ctx = new Ctx()
    this.ctx = ctx

    // compressor no fim: deixa o som cheio sem estourar nos picos do bumbo
    const glue = ctx.createDynamicsCompressor()
    glue.threshold.value = -18
    glue.knee.value = 12
    glue.ratio.value = 12
    glue.attack.value = 0.003
    glue.release.value = 0.25
    glue.connect(ctx.destination)
    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(glue)
    // tudo passa por um filtro passa-baixa: é o que dá o som "abafado" de fita
    const tape = ctx.createBiquadFilter()
    tape.type = 'lowpass'
    tape.frequency.value = 2400
    tape.Q.value = 0.6
    tape.connect(this.master)
    this.bus = ctx.createGain()
    this.bus.gain.value = 1
    this.bus.connect(tape)

    // fita oscilando de leve: um LFO lento mexe na afinação do piano
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.35
    this.wobble = ctx.createGain()
    this.wobble.gain.value = 7 // centésimos de semitom
    lfo.connect(this.wobble)
    lfo.start()

    const len = ctx.sampleRate * 2
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return ctx
  }

  start(volume: number) {
    const ctx = this.setup()
    if (!ctx || !this.master) return
    void ctx.resume()
    if (this.timer === null) {
      this.nextBarAt = ctx.currentTime + 0.15
      this.progression = Math.floor(Math.random() * PROGRESSIONS.length)
      this.startCrackle()
      this.schedule()
      this.timer = setInterval(() => this.schedule(), TICK_MS)
    }
    this.fadeTo(this.gainFor(volume), 1.2)
  }

  /** O navegador só libera o som depois de um toque: chamado a cada toque enquanto deve tocar. */
  resume() {
    if (this.ctx?.state === 'suspended') void this.ctx.resume()
  }

  stop() {
    if (!this.ctx || this.timer === null) return
    clearInterval(this.timer)
    this.timer = null
    this.fadeTo(0, 0.9)
    const crackle = this.crackle
    this.crackle = null
    setTimeout(() => {
      crackle?.stop()
      if (this.timer === null) void this.ctx?.suspend()
    }, 1000)
  }

  setVolume(volume: number) {
    if (this.playing) this.fadeTo(this.gainFor(volume), 0.15)
  }

  private gainFor(volume: number) {
    // calibrado para soar como uma música própria no mesmo volume (medido: ~-22 dB em 25%)
    return Math.max(0, Math.min(1, volume)) * 4.5
  }

  private fadeTo(value: number, seconds: number) {
    if (!this.ctx || !this.master) return
    const g = this.master.gain
    const now = this.ctx.currentTime
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    g.linearRampToValueAtTime(value, now + seconds)
  }

  private schedule() {
    const ctx = this.ctx
    if (!ctx) return
    while (this.nextBarAt < ctx.currentTime + LOOKAHEAD_S) {
      if (this.bar > 0 && this.bar % 8 === 0 && Math.random() < 0.5) {
        this.progression = (this.progression + 1 + Math.floor(Math.random() * 2)) % PROGRESSIONS.length
      }
      this.playBar(composeBar(this.bar, this.progression), this.nextBarAt)
      this.bar++
      this.nextBarAt += BEAT * 4
    }
  }

  private playBar(bar: Bar, t: number) {
    const at = (beat: number) => t + beat * BEAT + (beat % 1 === 0.5 ? BEAT * 0.12 : 0) // swing
    const [bass, ...voices] = bar.chord
    // acorde dedilhado de leve no 1 e repetido mais fraco no "e" do 2
    voices.forEach((m, i) => this.keys(m, t + i * 0.025, 0.07, 3.2))
    if (Math.random() < 0.6) voices.forEach((m, i) => this.keys(m, at(1.5) + i * 0.02, 0.035, 1.6))
    this.bassNote(bass, t, 0.22, BEAT * 1.6)
    this.bassNote(Math.random() < 0.5 ? bass : bass + 7, at(2.5), 0.16, BEAT * 1.2)
    for (const { beat, note } of bar.melody) this.keys(note, at(beat), 0.045, 1.8)
    if (!bar.drums) return
    for (const k of bar.kicks) this.kick(at(k))
    this.snare(at(1))
    this.snare(at(3))
    for (let b = 0; b < 4; b += 0.5) this.hat(at(b), b % 1 === 0 ? 0.035 : 0.022)
  }

  /** Piano elétrico: fundamental + harmônico de "sino" que some rápido. */
  private keys(midi: number, t: number, gain: number, decay: number) {
    const ctx = this.ctx!
    const f = midiToHz(midi)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(gain, t + 0.02)
    env.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    env.connect(this.bus!)
    const bell = ctx.createGain()
    bell.gain.setValueAtTime(gain * 0.5, t)
    bell.gain.exponentialRampToValueAtTime(0.0001, t + decay * 0.25)
    bell.connect(this.bus!)
    const parts: [OscillatorType, number, AudioNode][] = [['sine', f, env], ['triangle', f * 1.002, env], ['sine', f * 2, bell]]
    for (const [type, freq, out] of parts) {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = freq
      this.wobble?.connect(o.detune)
      const g = ctx.createGain()
      g.gain.value = type === 'triangle' ? 0.35 : 1
      o.connect(g).connect(out)
      o.start(t)
      o.stop(t + decay + 0.05)
      o.onended = () => this.wobble?.disconnect(o.detune)
    }
  }

  private bassNote(midi: number, t: number, gain: number, length: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = midiToHz(midi)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, t + length)
    o.connect(g).connect(this.bus!)
    o.start(t)
    o.stop(t + length + 0.05)
  }

  private kick(t: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(110, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.5, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    o.connect(g).connect(this.bus!)
    o.start(t)
    o.stop(t + 0.4)
  }

  private noiseHit(t: number, type: BiquadFilterType, freq: number, gain: number, decay: number) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    src.connect(filter).connect(g).connect(this.bus!)
    src.start(t, Math.random() * 1.5)
    src.stop(t + decay + 0.02)
  }

  private snare(t: number) {
    this.noiseHit(t, 'bandpass', 1700, 0.16, 0.2)
  }

  private hat(t: number, gain: number) {
    this.noiseHit(t, 'highpass', 7000, gain, 0.045)
  }

  /** Chiado e estalos do vinil, em loop, bem baixinho. */
  private startCrackle() {
    const ctx = this.ctx!
    const len = ctx.sampleRate * 4
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.02 + (Math.random() < 0.0004 ? (Math.random() * 2 - 1) * 0.7 : 0)
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 900
    const g = ctx.createGain()
    g.gain.value = 0.25
    src.connect(filter).connect(g).connect(this.master!)
    src.start()
    this.crackle = src
  }
}

export const lofi = new Lofi()
