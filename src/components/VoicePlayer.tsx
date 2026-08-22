import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause } from 'lucide-react'

interface VoicePlayerProps {
  src: string
  duration: number | null
  isMine: boolean
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const BAR_COUNT = 52
const HEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const v = Math.sin(i * 0.34) * 0.28 + Math.sin(i * 1.12) * 0.24 + Math.sin(i * 2.45) * 0.14 + 0.52
  return Math.round(Math.min(Math.max(v, 0.2), 1) * 22) + 3
})

export default function VoicePlayer({ src, duration, isMine }: VoicePlayerProps) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [actualDuration, setActualDuration] = useState(duration || 0)
  const [seeking, setSeeking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      if (audio.ended) audio.currentTime = 0
      audio.play().catch(() => {})
    }
  }, [playing])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => { if (!seeking) setCurrentTime(audio.currentTime) }
    const onMeta = () => { if (audio.duration && isFinite(audio.duration)) setActualDuration(audio.duration) }
    const onEnd = () => { setPlaying(false); setCurrentTime(0) }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('durationchange', onMeta)
      audio.removeEventListener('ended', onEnd)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [seeking])

  const seekFromEvent = (clientX: number) => {
    const audio = audioRef.current
    const bar = barRef.current
    if (!audio || !bar || !actualDuration) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
    audio.currentTime = ratio * actualDuration
    setCurrentTime(audio.currentTime)
  }

  const progress = actualDuration > 0 ? currentTime / actualDuration : 0
  const filledBars = progress * BAR_COUNT
  const displayTime = playing || currentTime > 0 ? currentTime : actualDuration

  const playedColor = isMine ? '#ffffff' : '#5288c1'
  const unplayedColor = isMine ? 'rgba(255,255,255,0.28)' : 'rgba(122,138,153,0.32)'
  const timeColor = isMine ? 'text-white/85' : 'text-tg-accent'

  return (
    <div className="flex items-center gap-2.5 w-full max-w-[280px] select-none" dir="ltr">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 ${isMine ? 'bg-white/25 hover:bg-white/35' : 'bg-tg-accent hover:bg-tg-accent2'}`}
      >
        {playing ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white ml-0.5" />}
      </button>
      <div
        ref={barRef}
        className="relative flex items-center gap-[1.5px] h-7 flex-1 cursor-pointer touch-none"
        onPointerDown={(e) => { setSeeking(true); seekFromEvent(e.clientX); (e.target as HTMLElement).setPointerCapture?.(e.pointerId) }}
        onPointerMove={(e) => { if (seeking) seekFromEvent(e.clientX) }}
        onPointerUp={(e) => { setSeeking(false); seekFromEvent(e.clientX); (e.target as HTMLElement).releasePointerCapture?.(e.pointerId) }}
      >
        {Array.from({ length: BAR_COUNT }).map((_, i) => {
          const partialRatio = Math.min(Math.max(filledBars - i, 0), 1)
          const h = HEIGHTS[i]
          return (
            <div key={i} className="flex-1 rounded-full relative overflow-hidden min-w-[2px]" style={{ height: `${h}px` }}>
              <div className="absolute inset-0 rounded-full" style={{ backgroundColor: unplayedColor }} />
              <div
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: playedColor, clipPath: `inset(0 ${(1 - partialRatio) * 100}% 0 0)` }}
              />
            </div>
          )
        })}
      </div>
      <span className={`text-xs tabular-nums font-medium leading-none shrink-0 ${timeColor}`}>
        {formatTime(displayTime)}
      </span>
    </div>
  )
}
