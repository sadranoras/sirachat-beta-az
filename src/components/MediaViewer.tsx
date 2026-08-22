import { useEffect, useState, useRef } from 'react'
import { X, Download, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import { getCachedFile, setCachedFile, saveToFolder, guessMime } from '../lib/fileCache'

export interface MediaItem {
  url: string
  type: 'image' | 'video'
  name: string
  messageId?: string
  fileUrl?: string
}

interface MediaViewerProps {
  items: MediaItem[]
  startIndex: number
  onClose: () => void
}

export default function MediaViewer({ items, startIndex, onClose }: MediaViewerProps) {
  const [index, setIndex] = useState(startIndex)
  const [downloading, setDownloading] = useState(false)
  const [cachedUrlMap, setCachedUrlMap] = useState<Record<string, string>>({})
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set())
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setIndex((i) => (i + 1) % items.length)
      if (e.key === 'ArrowRight') setIndex((i) => (i - 1 + items.length) % items.length)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [items.length, onClose])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const map: Record<string, string> = {}
      const dlIds = new Set<string>()
      for (const item of items) {
        if (!item.messageId) continue
        const cached = await getCachedFile(item.messageId)
        if (cached) {
          map[item.messageId] = URL.createObjectURL(cached)
          dlIds.add(item.messageId)
        }
      }
      if (!cancelled) {
        setCachedUrlMap(map)
        setDownloadedIds(dlIds)
      }
    })()
    return () => {
      cancelled = true
      Object.values(cachedUrlMap).forEach(url => URL.revokeObjectURL(url))
    }
  }, [items])

  const current = items[index]
  if (!current) return null

  const displayUrl = (current.messageId && cachedUrlMap[current.messageId]) || current.url
  const isDownloaded = current.messageId ? downloadedIds.has(current.messageId) : false

  const download = async () => {
    if (!current.fileUrl && !current.url) return
    setDownloading(true)
    try {
      let blob: Blob | null = null
      if (current.messageId) {
        blob = await getCachedFile(current.messageId)
      }
      if (!blob) {
        const res = await fetch(current.fileUrl || current.url)
        blob = await res.blob()
        if (current.messageId) {
          await setCachedFile(current.messageId, blob)
          setDownloadedIds(prev => new Set(prev).add(current.messageId!))
          setCachedUrlMap(prev => ({ ...prev, [current.messageId!]: URL.createObjectURL(blob!) }))
          window.dispatchEvent(new Event('cached-files-changed'))
        }
      }
      const fileName = current.name || 'media'
      await saveToFolder(blob!, fileName)
    } catch {}
    setDownloading(false)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10">
        <X size={24} />
      </button>
      <button onClick={download} disabled={downloading} className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors z-10 disabled:opacity-50 ${isDownloaded ? 'bg-tg-green/30 hover:bg-tg-green/40' : 'bg-white/10 hover:bg-white/20'}`}>
        {downloading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : isDownloaded ? (
          <CheckCircle2 size={22} className="text-tg-green" />
        ) : (
          <Download size={22} />
        )}
      </button>

      {items.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); setIndex((i) => (i + 1) % items.length) }} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10">
            <ChevronRight size={26} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setIndex((i) => (i - 1 + items.length) % items.length) }} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10">
            <ChevronLeft size={26} />
          </button>
        </>
      )}

      <div className="w-full h-full flex items-center justify-center p-4" onClick={onClose}>
        {current.type === 'image' ? (
          <img src={displayUrl} alt={current.name} className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        ) : (
          <video
            ref={videoRef}
            src={displayUrl}
            controls
            autoPlay
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>

      {items.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm tabular-nums">
          {index + 1} / {items.length}
        </div>
      )}
    </div>
  )
}
