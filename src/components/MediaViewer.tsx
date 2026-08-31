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
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [cachedUrlMap, setCachedUrlMap] = useState<Record<string, string>>({})
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set())
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null)
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const downloadAbort = useRef<AbortController | null>(null)

  const resetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }) }
  const touchDistance = (a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)

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

  useEffect(() => { resetZoom() }, [index])

  const current = items[index]
  if (!current) return null

  const displayUrl = (current.messageId && cachedUrlMap[current.messageId]) || current.url
  const isDownloaded = current.messageId ? downloadedIds.has(current.messageId) : false

  const download = async () => {
    if (!current.fileUrl && !current.url) return
    if (downloadAbort.current) {
      downloadAbort.current.abort()
      downloadAbort.current = null
      setDownloading(false)
      return
    }
    const controller = new AbortController()
    downloadAbort.current = controller
    setDownloading(true)
    setDownloadProgress(0)
    try {
      let blob: Blob | null = null
      if (current.messageId) blob = await getCachedFile(current.messageId)
      if (!blob) {
        const res = await fetch(current.fileUrl || current.url, { signal: controller.signal })
        if (!res.ok) throw new Error('Download failed')
        const total = Number(res.headers.get('content-length') || 0)
        if (res.body && total > 0) {
          const reader = res.body.getReader()
          const chunks: Uint8Array[] = []
          let loaded = 0
          while (true) {
            const part = await reader.read()
            if (part.done) break
            if (part.value) { chunks.push(part.value); loaded += part.value.byteLength; setDownloadProgress(Math.min(100, Math.round(loaded / total * 100))) }
          }
          blob = new Blob(chunks.map(chunk => new Uint8Array(chunk).buffer), { type: res.headers.get('content-type') || guessMime(current.name) })
        } else {
          blob = await res.blob()
          setDownloadProgress(100)
        }
        if (current.messageId) {
          await setCachedFile(current.messageId, blob)
          setDownloadedIds(prev => new Set(prev).add(current.messageId!))
          setCachedUrlMap(prev => ({ ...prev, [current.messageId!]: URL.createObjectURL(blob!) }))
          window.dispatchEvent(new Event('cached-files-changed'))
        }
      }
      await saveToFolder(blob!, current.name || 'media')
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error(e)
    } finally {
      if (downloadAbort.current === controller) downloadAbort.current = null
      setDownloading(false)
      setDownloadProgress(0)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10">
        <X size={24} />
      </button>
      <button onClick={download} className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors z-10 disabled:opacity-50 ${isDownloaded ? 'bg-tg-green/30 hover:bg-tg-green/40' : 'bg-white/10 hover:bg-white/20'}`}>
        {downloading ? (
          <svg width="36" height="36" viewBox="0 0 36 36" aria-label="در حال دانلود">
            <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="3" />
            <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray={2 * Math.PI * 15} strokeDashoffset={2 * Math.PI * 15 * (1 - downloadProgress / 100)} transform="rotate(-90 18 18)" />
            <rect x="13" y="13" width="10" height="10" rx="2" fill="currentColor" />
          </svg>
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
          <div
            className="max-w-full max-h-full touch-none overflow-visible"
            onWheel={(e) => { e.preventDefault(); setZoom(z => Math.min(4, Math.max(1, z - e.deltaY * 0.002))) }}
            onPointerDown={(e) => { if (zoom > 1) dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId) }}
            onPointerMove={(e) => { if (dragRef.current && zoom > 1) setPan({ x: dragRef.current.px + e.clientX - dragRef.current.x, y: dragRef.current.py + e.clientY - dragRef.current.y }) }}
            onPointerUp={() => { dragRef.current = null }}
            onTouchStart={(e) => { if (e.touches.length === 2) pinchRef.current = { distance: touchDistance(e.touches[0], e.touches[1]), zoom }; }}
            onTouchMove={(e) => { if (e.touches.length === 2 && pinchRef.current) { const d = touchDistance(e.touches[0], e.touches[1]); setZoom(Math.min(4, Math.max(1, pinchRef.current.zoom * d / pinchRef.current.distance))); } }}
            onTouchEnd={() => { pinchRef.current = null }}
            onDoubleClick={() => zoom > 1 ? resetZoom() : setZoom(2)}
            onClick={(e) => e.stopPropagation()}
          >
            <img src={displayUrl} alt={current.name} className="max-w-full max-h-[90vh] object-contain rounded-lg select-none transition-transform duration-75" draggable={false} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }} />
          </div>
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
