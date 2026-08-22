import { useState, useEffect, useMemo, useCallback } from 'react'
import { Trash2, FileText, Image as ImageIcon, Film, Music, File, Loader2, CheckCircle2, X, ChevronLeft } from 'lucide-react'
import { listCachedFiles, deleteCachedFiles, type CachedFileEntry } from '../lib/fileCache'
import { formatBytes } from '../lib/format'

type Category = 'all' | 'image' | 'video' | 'audio' | 'document' | 'other'

const CATEGORY_LABELS: Record<Exclude<Category, 'all'>, string> = {
  image: 'عکس',
  video: 'فیلم',
  audio: 'صوت',
  document: 'سند',
  other: 'سایر',
}

const CATEGORY_ICONS: Record<Exclude<Category, 'all'>, typeof ImageIcon> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  document: FileText,
  other: File,
}

export default function DownloadedFilesManager() {
  const [files, setFiles] = useState<CachedFileEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<Category>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const loadFiles = useCallback(async () => {
    setLoading(true)
    const list = await listCachedFiles()
    setFiles(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (expanded) loadFiles()
  }, [expanded, loadFiles])

  const counts = useMemo(() => {
    const c: Record<string, number> = { image: 0, video: 0, audio: 0, document: 0, other: 0 }
    for (const f of files) c[f.category]++
    return c
  }, [files])

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return files
    return files.filter(f => f.category === activeCategory)
  }, [files, activeCategory])

  const totalSize = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files])
  const selectedSize = useMemo(() => {
    let s = 0
    for (const f of files) if (selected.has(f.id)) s += f.size
    return s
  }, [files, selected])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setDeleted(false)
  }

  const selectAll = () => {
    setSelected(new Set(filtered.map(f => f.id)))
    setDeleted(false)
  }

  const clearSelection = () => setSelected(new Set())

  const handleDelete = async () => {
    if (selected.size === 0) return
    setDeleting(true)
    await deleteCachedFiles([...selected])
    window.dispatchEvent(new Event('cached-files-changed'))
    setDeleting(false)
    setSelected(new Set())
    setDeleted(true)
    await loadFiles()
    setTimeout(() => setDeleted(false), 2000)
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-between bg-tg-hover/40 rounded-xl px-4 py-3 transition-colors hover:bg-tg-hover"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-tg-accent/15 flex items-center justify-center flex-shrink-0">
            <FileText size={18} className="text-tg-accent" />
          </div>
          <div className="text-right">
            <p className="text-tg-text text-sm">فایل‌های دانلود شده</p>
            <p className="text-tg-subtext text-xs mt-0.5">
              {files.length > 0 ? `${files.length} فایل · ${formatBytes(totalSize)}` : 'مشاهده فایل‌های دانلود شده'}
            </p>
          </div>
        </div>
        <ChevronLeft size={20} className="text-tg-subtext" />
      </button>
    )
  }

  return (
    <div className="rounded-xl bg-tg-hover/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-tg-border">
        <button onClick={() => { setExpanded(false); setSelected(new Set()) }} className="flex items-center gap-2 text-tg-text hover:text-tg-accent transition-colors">
          <X size={18} />
          <span className="text-sm font-medium">فایل‌های دانلود شده</span>
        </button>
        <button onClick={loadFiles} disabled={loading} className="text-tg-subtext hover:text-tg-accent transition-colors">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <ChevronLeft size={16} className="rotate-180" />}
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 px-3 py-2 overflow-x-auto scrollbar-none">
        {(['all', 'image', 'video', 'audio', 'document', 'other'] as Category[]).map(cat => {
          const count = cat === 'all' ? files.length : counts[cat]
          if (cat !== 'all' && count === 0) return null
          const isActive = activeCategory === cat
          const Icon = cat === 'all' ? File : CATEGORY_ICONS[cat]
          return (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setSelected(new Set()) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                isActive ? 'bg-tg-accent text-white' : 'bg-tg-hover text-tg-subtext hover:text-tg-text'
              }`}
            >
              <Icon size={13} />
              <span>{cat === 'all' ? 'همه' : CATEGORY_LABELS[cat]}</span>
              <span className={`text-[10px] ${isActive ? 'text-white/70' : 'text-tg-subtext/70'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Selection bar */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-tg-panel/50">
          <div className="flex items-center gap-3 text-xs">
            {selected.size > 0 ? (
              <>
                <button onClick={clearSelection} className="text-tg-subtext hover:text-tg-text transition-colors">لغو</button>
                <button onClick={selectAll} className="text-tg-accent hover:opacity-80 transition-opacity">انتخاب همه</button>
                <span className="text-tg-subtext">|</span>
                <span className="text-tg-text">{selected.size} مورد انتخاب شده</span>
                <span className="text-tg-accent font-medium">{formatBytes(selectedSize)}</span>
              </>
            ) : (
              <>
                <span className="text-tg-subtext">{filtered.length} فایل</span>
                <span className="text-tg-subtext">|</span>
                <span className="text-tg-text">{formatBytes(filtered.reduce((s, f) => s + f.size, 0))} حجم کل</span>
              </>
            )}
          </div>
          {selected.size > 0 && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                deleted ? 'bg-tg-green/20 text-tg-green' : 'bg-tg-red/10 text-tg-red hover:bg-tg-red/20'
              }`}
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : deleted ? <CheckCircle2 size={14} /> : <Trash2 size={14} />}
              {deleting ? '...' : deleted ? 'حذف شد' : `حذف (${selected.size})`}
            </button>
          )}
        </div>
      )}

      {/* File list */}
      <div className="max-h-[320px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-tg-accent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-tg-subtext">
            <File size={32} className="mb-2 opacity-40" />
            <p className="text-sm">فایلی دانلود نشده</p>
          </div>
        ) : (
          <div className="divide-y divide-tg-border/50">
            {filtered.map(f => {
              const Icon = CATEGORY_ICONS[f.category as Exclude<Category, 'all'>] || File
              const isSelected = selected.has(f.id)
              return (
                <button
                  key={f.id}
                  onClick={() => toggleSelect(f.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-right ${
                    isSelected ? 'bg-tg-accent/10' : 'hover:bg-tg-hover/50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected ? 'bg-tg-accent border-tg-accent' : 'border-tg-border'
                  }`}>
                    {isSelected && <CheckCircle2 size={12} className="text-white" />}
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-tg-hover flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-tg-subtext" />
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-tg-text text-xs truncate">{f.id.length > 36 ? f.id.slice(0, 8) + '…' : f.id}</p>
                    <p className="text-tg-subtext text-[11px] mt-0.5">{formatBytes(f.size)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
