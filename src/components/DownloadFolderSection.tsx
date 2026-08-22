import { useState, useEffect } from 'react'
import { Loader2, FolderOpen, RotateCcw } from 'lucide-react'
import { pickDownloadFolder, clearDownloadFolder, getDownloadFolderHandle, hasFolderPicker } from '../lib/fileCache'

export default function DownloadFolderSection() {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDownloadFolderHandle().then((h: FileSystemDirectoryHandle | null) => setConnected(!!h))
  }, [])

  if (!hasFolderPicker()) return null

  const pick = async () => {
    setConnecting(true)
    setError(null)
    const handle = await pickDownloadFolder()
    setConnecting(false)
    if (handle) setConnected(true)
    else setError('مرورگر شما از انتخاب پوشه پشتیبانی نمی‌کند')
  }

  const disconnect = async () => {
    await clearDownloadFolder()
    setConnected(false)
  }

  return (
    <div className={`flex items-center justify-between rounded-xl px-4 py-3 mb-2 ${connected ? 'bg-tg-green/10' : 'bg-tg-hover/40'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-tg-text text-sm">پوشه دانلودها</p>
        <p className="text-tg-subtext text-xs mt-0.5 truncate">
          {connected ? 'فایل‌ها در پوشه سیرا چت ذخیره می‌شوند' : 'فایل‌ها در پوشه پیش‌فرض ذخیره می‌شوند'}
        </p>
        {error && <p className="text-tg-red text-xs mt-1">{error}</p>}
      </div>
      {connected ? (
        <button
          onClick={disconnect}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-tg-hover text-tg-subtext hover:bg-tg-border transition-colors flex-shrink-0"
        >
          <RotateCcw size={16} />
          <span>پیش‌فرض</span>
        </button>
      ) : (
        <button
          onClick={pick}
          disabled={connecting}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-tg-accent/15 text-tg-accent hover:bg-tg-accent/25 transition-colors flex-shrink-0"
        >
          {connecting ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}
          <span>{connecting ? '...' : 'انتخاب پوشه'}</span>
        </button>
      )}
    </div>
  )
}
