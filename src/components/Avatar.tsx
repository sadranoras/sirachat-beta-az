interface AvatarProps { url: string | null | undefined; name: string; size: number; online?: boolean }

export default function Avatar({ url, name, size, online = false }: AvatarProps) {
  const initials = (name || '?').charAt(0).toUpperCase()
  const content = url
    ? <img src={url} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover flex-shrink-0" />
    : <div style={{ width: size, height: size, fontSize: size * 0.4 }} className="rounded-full bg-tg-accent flex items-center justify-center text-white font-medium flex-shrink-0">{initials}</div>
  return <div className="relative shrink-0 inline-block">{content}{online && <span className="absolute bottom-0 left-0 w-3 h-3 rounded-full bg-tg-green border-2 border-tg-panel" />}</div>
}
