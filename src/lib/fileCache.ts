const DB_NAME = 'sirachat-files'
const STORE = 'files'
const DB_VERSION = 1

const FOLDER_KEY = 'sirachat-download-folder-handle'
const DEFAULT_FOLDER_NAME = 'سیرا چت'

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', txt: 'text/plain',
  mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', ogg: 'audio/ogg',
  json: 'application/json', html: 'text/html', css: 'text/css', js: 'text/javascript',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed',
  avif: 'image/avif', heic: 'image/heic', heif: 'image/heif', jxl: 'image/jxl',
  bmp: 'image/bmp', ico: 'image/x-icon', tif: 'image/tiff', tiff: 'image/tiff', jfif: 'image/jpeg',
  mov: 'video/quicktime', m4v: 'video/x-m4v', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
  mpeg: 'video/mpeg', mpg: 'video/mpeg', ogv: 'video/ogg', '3gp': 'video/3gpp', flv: 'video/x-flv',
  wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', opus: 'audio/opus',
  oga: 'audio/ogg', amr: 'audio/amr', aiff: 'audio/aiff', aif: 'audio/aiff',
  csv: 'text/csv', xml: 'application/xml', md: 'text/markdown', rtf: 'application/rtf',
  epub: 'application/epub+zip', mobi: 'application/x-mobipocket-ebook', apk: 'application/vnd.android.package-archive',
  dmg: 'application/x-apple-diskimage', exe: 'application/vnd.microsoft.portable-executable',
  wasm: 'application/wasm', bin: 'application/octet-stream', iso: 'application/x-iso9660-image',
}

export function guessMime(fileName: string): string | undefined {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return MIME_BY_EXT[ext]
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getCachedFile(messageId: string): Promise<Blob | null> {
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(messageId)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function setCachedFile(messageId: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(blob, messageId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // cache failures are non-fatal
  }
}

export function openBlob(blob: Blob, fileName: string): void {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const mime = guessMime(fileName)
  let finalBlob = blob
  if (mime && (!blob.type || blob.type === 'application/octet-stream')) {
    finalBlob = new Blob([blob], { type: mime })
  }
  const url = URL.createObjectURL(finalBlob)
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  const inlineTypes = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'pdf', 'txt', 'mp4', 'webm', 'mp3', 'ogg']
  if (inlineTypes.includes(ext)) {
    a.target = '_blank'
  } else {
    a.download = fileName
  }
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

export function saveBlobAsDownload(blob: Blob, fileName: string): void {
  const mime = guessMime(fileName)
  let finalBlob = blob
  if (mime && (!blob.type || blob.type === 'application/octet-stream')) {
    finalBlob = new Blob([blob], { type: mime })
  }
  const url = URL.createObjectURL(finalBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

function supportsDirHandle(): boolean {
  return typeof (window as any).showDirectoryPicker === 'function'
}

export async function getDownloadFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsDirHandle()) return null
  try {
    const handle = await (navigator as any).dirs?.getPreferredDirHandle?.()
    if (handle) return handle
  } catch {}
  try {
    const raw = localStorage.getItem(FOLDER_KEY)
    if (raw) {
      const handle = JSON.parse(raw)
      // verify permission still granted
      const perm = await (handle as any).queryPermission?.({ mode: 'readwrite' })
      if (perm === 'granted') return handle as FileSystemDirectoryHandle
      const req = await (handle as any).requestPermission?.({ mode: 'readwrite' })
      if (req === 'granted') return handle as FileSystemDirectoryHandle
    }
  } catch {}
  return null
}

export async function pickDownloadFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsDirHandle()) return null
  try {
    const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite', id: 'sirachat-downloads' })
    localStorage.setItem(FOLDER_KEY, JSON.stringify(handle))
    return handle as FileSystemDirectoryHandle
  } catch {
    return null
  }
}

export async function clearDownloadFolder(): Promise<void> {
  localStorage.removeItem(FOLDER_KEY)
}

export function hasFolderPicker(): boolean {
  return supportsDirHandle()
}

async function ensureSubfolder(root: FileSystemDirectoryHandle, name: string): Promise<FileSystemDirectoryHandle> {
  try {
    return await root.getDirectoryHandle(name, { create: true })
  } catch {
    return root
  }
}

export async function saveToFolder(blob: Blob, fileName: string): Promise<'folder' | 'fallback'> {
  const folder = await getDownloadFolderHandle()
  if (folder) {
    try {
      const sub = await ensureSubfolder(folder, DEFAULT_FOLDER_NAME)
      const safeName = sanitizeFileName(fileName)
      const fileHandle = await sub.getFileHandle(safeName, { create: true })
      const writable = await (fileHandle as any).createWritable()
      await writable.write(blob)
      await writable.close()
      return 'folder'
    } catch {
      // fall through to fallback
    }
  }
  saveBlobAsDownload(blob, fileName)
  return 'fallback'
}

function sanitizeFileName(name: string): string {
  // Strip path separators and control chars; keep extension
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim()
  return cleaned || 'file'
}

export async function getCachedFileIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  try {
    const db = await openDB()
    return await new Promise<Set<string>>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const store = tx.objectStore(STORE)
      const found = new Set<string>()
      let pending = ids.length
      if (pending === 0) { resolve(found); return }
      for (const id of ids) {
        const req = store.get(id)
        req.onsuccess = () => { if (req.result) found.add(id); if (--pending === 0) resolve(found) }
        req.onerror = () => { if (--pending === 0) resolve(found) }
      }
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    return new Set()
  }
}

export async function clearAllCachedFiles(): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // clearing failures are non-fatal
  }
}

export async function getCachedFilesCount(): Promise<number> {
  try {
    const db = await openDB()
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).count()
      req.onsuccess = () => resolve(req.result || 0)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return 0
  }
}

export type CachedFileEntry = {
  id: string
  size: number
  type: string
  category: 'image' | 'video' | 'audio' | 'document' | 'other'
}

export async function listCachedFiles(): Promise<CachedFileEntry[]> {
  try {
    const db = await openDB()
    return await new Promise<CachedFileEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const store = tx.objectStore(STORE)
      const entries: CachedFileEntry[] = []
      const req = store.openKeyCursor()
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null
        if (cursor) {
          const id = String(cursor.key)
          const getReq = store.get(id)
          getReq.onsuccess = () => {
            const blob = getReq.result as Blob | undefined
            if (blob) {
              entries.push({ id, size: blob.size, type: blob.type, category: categorizeBlob(blob.type, id) })
            }
            cursor.continue()
          }
        } else {
          resolve(entries)
        }
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  }
}

export async function deleteCachedFiles(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      for (const id of ids) store.delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // deletion failures are non-fatal
  }
}

function categorizeBlob(type: string, id: string): CachedFileEntry['category'] {
  const t = (type || '').toLowerCase()
  const ext = id.split('.').pop()?.toLowerCase() || ''
  if (t.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image'
  if (t.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video'
  if (t.startsWith('audio/') || ['mp3', 'ogg', 'wav', 'm4a', 'aac', 'flac'].includes(ext)) return 'audio'
  if (t.startsWith('text/') || ['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'json', 'html', 'css', 'js', 'zip', 'rar', '7z'].includes(ext)) return 'document'
  return 'other'
}

export function formatDayDivider(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'امروز'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'دیروز'
  return d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })
}
