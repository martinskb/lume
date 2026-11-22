import { Vinyl } from '../vinyl/Vinyl'
import { Avatar } from './Avatar'

/** A pessoa como disco: o avatar é o rótulo, o acabamento mostra o nível (ou a posição no pódio). */
export function DiscAvatar({ nickname, level, size }: { nickname: string; level?: string; size: number }) {
  return (
    <span className="disc-avatar" style={{ width: size }} aria-hidden="true">
      <Vinyl palette="noite" level={level} />
      <Avatar nickname={nickname} size={Math.round(size * 0.42)} />
    </span>
  )
}
