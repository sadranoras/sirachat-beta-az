export type CachedFileCategory = 'image' | 'video' | 'audio' | 'document' | 'other'
export interface CachedFileEntry {
  id: string
  size: number
  type: string
  name: string
  category: CachedFileCategory
  createdAt: number
}

const DB = 'sira-file-cache'
const STORE = 'files'
const META = 'meta'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 2)
    r.onupgradeneeded = () => {
      const db = r.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META)
    }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

function category(type: string, name = ''): CachedFileCategory {
  const t = (type || '').toLowerCase()
  const n = name.toLowerCase()
  if (t.startsWith('image/')) return 'image'
  if (t.startsWith('video/')) return 'video'
  if (t.startsWith('audio/')) return 'audio'
  if (/\.(pdf|docx?|xlsx?|pptx?|txt|csv|zip|rar|7z|apk|json|xml|html|md|epub|mobi)$/i.test(n)) return 'document'
  return 'other'
}

export function guessMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  const map: Record<string,string> = {
    jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',
    mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',
    mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',m4a:'audio/mp4',
    pdf:'application/pdf',json:'application/json',txt:'text/plain',csv:'text/csv',
    zip:'application/zip'
  }
  return (ext && map[ext]) || 'application/octet-stream'
}

export function formatDayDivider(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('fa-IR', { year:'numeric', month:'long', day:'numeric' }).format(d)
}

export async function getCachedFile(key: string): Promise<Blob | null> {
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      r.onsuccess = () => resolve((r.result as Blob) || null)
      r.onerror = () => reject(r.error)
    })
  } catch { return null }
}

export async function setCachedFile(key: string, blob: Blob, name = key): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE, META], 'readwrite')
      tx.objectStore(STORE).put(blob, key)
      tx.objectStore(META).put({
        id:key, size:blob.size, type:blob.type || guessMime(name),
        name, category:category(blob.type || guessMime(name), name), createdAt:Date.now()
      }, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {}
}

export async function fetchFileOnce(url: string, key: string, signal?: AbortSignal): Promise<Blob> {
  const cached = await getCachedFile(key)
  if (cached) return cached
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Download failed: ${response.status}`)
  const blob = await response.blob()
  await setCachedFile(key, blob)
  return blob
}

export async function openBlob(blob: Blob, fileName = 'file') {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

let downloadFolderHandle: FileSystemDirectoryHandle | null = null

export function hasFolderPicker(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function pickDownloadFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!hasFolderPicker()) return null
  try {
    downloadFolderHandle = await (window as any).showDirectoryPicker({ mode:'readwrite' })
    return downloadFolderHandle
  } catch { return null }
}

export async function getDownloadFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  return downloadFolderHandle
}

export async function clearDownloadFolder(): Promise<void> {
  downloadFolderHandle = null
}

export async function saveToFolder(blob: Blob, fileName: string): Promise<void> {
  if (downloadFolderHandle) {
    try {
      const handle = await downloadFolderHandle.getFileHandle(fileName, { create:true })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch {}
  }
  await openBlob(blob, fileName)
}

export async function getCachedFileIds(ids: string[]): Promise<Set<string>> {
  const result = new Set<string>()
  await Promise.all(ids.map(async id => { if (await getCachedFile(id)) result.add(id) }))
  return result
}

export async function listCachedFiles(): Promise<CachedFileEntry[]> {
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const r = db.transaction(META, 'readonly').objectStore(META).getAll()
      r.onsuccess = () => resolve((r.result || []) as CachedFileEntry[])
      r.onerror = () => reject(r.error)
    })
  } catch { return [] }
}

export async function deleteCachedFiles(ids: string[]): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE, META], 'readwrite')
      for (const id of ids) { tx.objectStore(STORE).delete(id); tx.objectStore(META).delete(id) }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {}
}
