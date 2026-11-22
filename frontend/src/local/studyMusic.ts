import { useSyncExternalStore } from 'react'
import { deviceStore, keepOnDevice } from './deviceStore'
import { lofi } from './lofi'

// Músicas para estudar: arquivos da própria pessoa, guardados só neste aparelho.
// Tocam baixinho enquanto o disco gira e pausam junto com ele.
// Sem músicas no aparelho, toca o lofi gerado pelo próprio app (local/lofi.ts).

export type Track = { id: number; name: string; size: number; blob: Blob; addedAt: number }
export type TrackInfo = Omit<Track, 'blob'>

export const MAX_TRACK_BYTES = 40 * 1024 * 1024
const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i

/** Aceita pelo tipo do arquivo ou, quando o celular não informa o tipo, pela extensão. */
export function isAudioFile(name: string, type: string): boolean {
  return type.startsWith('audio/') || AUDIO_EXT.test(name)
}

/** "02 - Lofi tranquilo.mp3" → "02 - Lofi tranquilo" */
export function trackTitle(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_]+/g, ' ').trim() || 'Música'
}

/** Embaralha (Fisher–Yates); `random` entra como parâmetro para dar para testar. */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ---------- preferências (por aparelho) ----------
const ON_KEY = 'music:on'
const VOLUME_KEY = 'music:volume'
const read = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    // armazenamento bloqueado: vale só nesta aba
  }
}

// ---------- estado observável (lista + preferências) ----------
type State = { tracks: TrackInfo[]; on: boolean; volume: number; ready: boolean }
let state: State = {
  tracks: [],
  on: read(ON_KEY) !== '0',
  volume: Number(read(VOLUME_KEY) ?? 0.25),
  ready: false,
}
const listeners = new Set<() => void>()
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

let loading: Promise<void> | null = null
function load(): Promise<void> {
  if (!loading) {
    loading = deviceStore
      .all<Track>('tracks')
      .then((all) => set({ tracks: all.map(({ blob: _blob, ...info }) => info), ready: true }))
      .catch(() => set({ ready: true }))
  }
  return loading
}

export function useStudyMusic(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      void load()
      return () => void listeners.delete(l)
    },
    () => state,
  )
}

export async function addTracks(files: File[]): Promise<string | null> {
  let skipped = 0
  for (const f of files) {
    if (!isAudioFile(f.name, f.type) || f.size > MAX_TRACK_BYTES) {
      skipped++
      continue
    }
    await deviceStore.put('tracks', { name: trackTitle(f.name), size: f.size, blob: f, addedAt: Date.now() })
  }
  keepOnDevice()
  loading = null
  await load()
  player.reshuffle()
  player.refresh()
  if (skipped === 0) return null
  return skipped === files.length
    ? 'Esses arquivos não são músicas ou passam de 40 MB.'
    : `${skipped} ${skipped === 1 ? 'arquivo ficou' : 'arquivos ficaram'} de fora (não é música ou passa de 40 MB).`
}

export async function removeTrack(id: number): Promise<void> {
  await deviceStore.remove('tracks', id)
  set({ tracks: state.tracks.filter((t) => t.id !== id) })
  player.forget(id)
  player.reshuffle()
  player.refresh()
}

export function setMusicOn(on: boolean): void {
  write(ON_KEY, on ? '1' : '0')
  set({ on })
  if (on) player.refresh()
  else player.pause()
}

export function setMusicVolume(volume: number): void {
  write(VOLUME_KEY, String(volume))
  set({ volume })
  player.applyVolume()
}

// ---------- o tocador ----------
const mediaState = (s: MediaSessionPlaybackState) => {
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = s
}
const FADE_MS = 900

class Player {
  private audio: HTMLAudioElement | null = null
  private order: number[] = []
  private index = 0
  private url: string | null = null
  private loadedId: number | null = null
  private fade = 0
  private wantPlaying = false

  private el(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio()
      this.audio.preload = 'auto'
      this.audio.addEventListener('ended', () => void this.next())
    }
    return this.audio
  }

  reshuffle() {
    this.order = shuffle(state.tracks.map((t) => t.id))
    this.index = 0
  }

  /** Carrega a música da vez (antes do toque, para o play caber no gesto da pessoa). */
  async prepare(): Promise<boolean> {
    await load()
    if (!state.on || state.tracks.length === 0) return false
    if (this.order.length !== state.tracks.length) this.reshuffle()
    const id = this.order[this.index % this.order.length]
    if (this.loadedId === id) return true
    const track = await deviceStore.get<Track>('tracks', id).catch(() => undefined)
    if (!track) return false
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = URL.createObjectURL(track.blob)
    this.loadedId = id
    const a = this.el()
    a.src = this.url
    if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
      navigator.mediaSession.metadata = new MediaMetadata({ title: track.name, artist: 'Lume · estudando' })
    }
    return true
  }

  private async next() {
    this.index = (this.index + 1) % Math.max(1, this.order.length)
    this.loadedId = null
    if (await this.prepare()) this.play()
  }

  /** Liga/desliga junto com o disco. Chamado direto do toque em Tocar/Pausar/Retomar e a cada segundo. */
  sync(playing: boolean) {
    if (playing === this.wantPlaying) return
    this.wantPlaying = playing
    if (playing) this.play()
    else this.stop()
  }

  private play() {
    if (!state.on) return
    if (state.tracks.length === 0) {
      lofi.start(state.volume)
      mediaState('playing')
      return
    }
    lofi.stop() // a pessoa acabou de adicionar músicas: as dela assumem
    const a = this.el()
    if (!a.getAttribute('src')) {
      void this.prepare().then((ok) => ok && this.wantPlaying && this.play())
      return
    }
    a.volume = 0
    a.play()
      .then(() => {
        mediaState('playing')
        this.ramp(state.volume)
      })
      .catch(() => {}) // navegador pode bloquear sem toque
  }

  /** Chamado ao mudar a lista ou ligar a música com o disco já girando. */
  refresh() {
    if (!this.wantPlaying) return
    lofi.resume()
    if (state.tracks.length === 0 ? !lofi.playing : !this.audio || this.audio.paused) this.play()
  }

  /** Tira do tocador a música que foi apagada. */
  forget(id: number) {
    if (this.loadedId !== id) return
    this.audio?.pause()
    this.audio?.removeAttribute('src')
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = null
    this.loadedId = null
  }

  stop() {
    this.wantPlaying = false
    this.pause()
  }

  /** Pausa o som sem esquecer que o disco está girando. */
  pause() {
    if (lofi.playing) {
      lofi.stop()
      mediaState('paused')
    }
    if (!this.audio || this.audio.paused) return
    const a = this.audio
    this.ramp(0, () => {
      a.pause()
      mediaState('paused')
    })
  }

  applyVolume() {
    lofi.setVolume(state.volume)
    if (this.audio && !this.audio.paused) this.audio.volume = state.volume
  }

  private ramp(to: number, done?: () => void) {
    const a = this.el()
    cancelAnimationFrame(this.fade)
    const from = a.volume
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / FADE_MS)
      a.volume = Math.max(0, Math.min(1, from + (to - from) * t))
      if (t < 1) this.fade = requestAnimationFrame(step)
      else done?.()
    }
    this.fade = requestAnimationFrame(step)
  }
}

export const player = new Player()
