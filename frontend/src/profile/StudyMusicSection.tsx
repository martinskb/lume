import { useEffect, useRef, useState } from 'react'
import { addTracks, player, previewLofi, removeTrack, setMusicOn, setMusicVolume, useStudyMusic } from '../local/studyMusic'

const mb = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`

/** Músicas para estudar: arquivos da própria pessoa, só neste aparelho, tocando baixinho com o disco. */
export function StudyMusicSection() {
  const { tracks, on, volume, ready } = useStudyMusic()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [previewing, setPreviewing] = useState(false)
  useEffect(() => () => previewLofi(false), []) // saiu do Perfil: para a prévia

  async function add(list: FileList | null) {
    if (!list || list.length === 0) return
    setBusy(true)
    setNote('')
    try {
      setNote((await addTracks([...list])) ?? '')
    } catch {
      setNote('Não deu para guardar no aparelho. Pode estar sem espaço.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <section className="card stack music-card" style={{ gap: 'var(--space-4)' }} aria-label="Músicas para estudar">
      <div className="stack" style={{ gap: 2 }}>
        <h2>Músicas para estudar</h2>
        <p className="muted small">Tocam baixinho enquanto o disco gira. Sem músicas suas, toca o lofi do Lume. As suas ficam só neste aparelho.</p>
      </div>

      <label className="switch-row">
            <span>Tocar enquanto estudo</span>
            <input type="checkbox" role="switch" className="switch" checked={on} onChange={(e) => setMusicOn(e.target.checked)} />
          </label>
          <label className="volume-row">
            <span className="muted small">Volume</span>
            <input
              type="range"
              min={0.05}
              max={0.8}
              step={0.05}
              value={volume}
              onChange={(e) => setMusicVolume(Number(e.target.value))}
              disabled={!on}
              aria-label="Volume das músicas"
            />
          </label>
      {tracks.length === 0 && !player.active && (
        <button
          className="btn ghost small"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => {
            previewLofi(!previewing)
            setPreviewing(!previewing)
          }}
        >
          {previewing ? '■ Parar' : '▶ Ouvir o lofi'}
        </button>
      )}
      {tracks.length > 0 && (
          <ul className="track-list">
            {tracks.map((t) => (
              <li key={t.id}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" />
                </svg>
                <span className="truncate grow">{t.name}</span>
                <span className="muted small">{mb(t.size)}</span>
                <button className="icon-btn" onClick={() => void removeTrack(t.id)} aria-label={`Remover ${t.name}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </li>
            ))}
          </ul>
      )}

      {note && <p className="muted small" role="status">{note}</p>}
      <button className="btn soft block" disabled={busy || !ready} onClick={() => fileRef.current?.click()}>
        {busy ? 'Guardando…' : '+ Adicionar músicas'}
      </button>
      <input ref={fileRef} type="file" accept="audio/*,.mp3,.m4a,.ogg,.opus,.wav,.flac" multiple hidden onChange={(e) => void add(e.target.files)} />
    </section>
  )
}
