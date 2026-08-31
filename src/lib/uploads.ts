import { supabase } from './supabase'
import { Message } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export interface ActiveUpload {
  tempId: string
  chatId: string
  fileName: string
  fileSize: number
  type: 'image' | 'file'
  caption: string
  progress: number
  status: 'uploading' | 'inserting' | 'done' | 'error'
  message: Message | null
}

type Listener = (uploads: ActiveUpload[]) => void

const activeUploads = new Map<string, ActiveUpload>()
const uploadControllers = new Map<string, AbortController>()
const listeners = new Set<Listener>()

function notify() {
  const all = Array.from(activeUploads.values())
  for (const l of listeners) l(all)
}

export function subscribeUploads(listener: Listener): () => void {
  listeners.add(listener)
  listener(Array.from(activeUploads.values()))
  return () => { listeners.delete(listener) }
}

export function getUploadsForChat(chatId: string): ActiveUpload[] {
  return Array.from(activeUploads.values()).filter(u => u.chatId === chatId)
}

async function uploadWithProgress(bucket: string, path: string, body: Blob, onProgress: (pct: number) => void, signal?: AbortSignal): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token || supabaseAnonKey
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let settled = false
    const fail = (err: unknown) => { if (!settled) { settled = true; reject(err) } }
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.min(100, Math.round(e.loaded / e.total * 100))) }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress(100); if (!settled) { settled = true; resolve(path) } }
      else fail(new Error(`Upload failed: ${xhr.status}`))
    }
    xhr.onerror = () => fail(new Error('Network error'))
    xhr.onabort = () => fail(new DOMException('Upload cancelled', 'AbortError'))
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.open('POST', `${supabaseUrl}/storage/v1/object/${bucket}/${path}`, true)
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
    xhr.setRequestHeader('apikey', supabaseAnonKey)
    xhr.setRequestHeader('Content-Type', body.type || 'application/octet-stream')
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.send(body)
  })
}

async function compressImage(file: File, maxDim: number, quality: number): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round(height * maxDim / width)
          width = maxDim
        } else {
          width = Math.round(width * maxDim / height)
          height = maxDim
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        resolve(blob || file)
      }, 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

export function cancelUpload(tempId: string) {
  const controller = uploadControllers.get(tempId)
  if (controller) controller.abort()
  if (activeUploads.delete(tempId)) notify()
}

export async function startFileUpload(
  chatId: string,
  userId: string,
  file: File,
  caption: string,
  type: 'image' | 'file',
  replyToId: string | null,
  sender: Message['sender'],
): Promise<void> {
  const ext = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`

  let uploadFile: Blob = file
  let uploadName = file.name
  let uploadSize = file.size

  if (type === 'image' && file.size > 300 * 1024) {
    const compressed = await compressImage(file, 1920, 0.82)
    if (compressed.size < file.size) {
      uploadFile = compressed
      uploadSize = compressed.size
      if (!ext || ext.toLowerCase() !== 'jpg' && ext.toLowerCase() !== 'jpeg') {
        uploadName = file.name.replace(/\.[^.]+$/, '.jpg')
      }
    }
  }

  const optimistic: Message = {
    id: tempId, chat_id: chatId, sender_id: userId, content: caption || '',
    created_at: new Date().toISOString(), message_type: type, file_url: null,
    file_name: file.name, file_size: file.size, duration: null,
    is_edited: false, is_pinned: false, reply_to: replyToId,
    forwarded_from: null, deleted_at: null, read_at: null, sender: sender || undefined, reactions: [],
  }

  const entry: ActiveUpload = {
    tempId, chatId, fileName: file.name, fileSize: file.size, type, caption,
    progress: 0, status: 'uploading', message: optimistic,
  }
  activeUploads.set(tempId, entry)
  uploadControllers.set(tempId, new AbortController())
  notify()

  let filePath: string
  try {
    const pathExt = uploadName.split('.').pop() || ext
    const compressedName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${pathExt}`
    filePath = await uploadWithProgress('media', compressedName, uploadFile, (pct) => {
      const e = activeUploads.get(tempId)
      if (e) { e.progress = pct; notify() }
    }, uploadControllers.get(tempId)?.signal)
  } catch (err) {
    const aborted = uploadControllers.get(tempId)?.signal.aborted
    uploadControllers.delete(tempId)
    const e = activeUploads.get(tempId)
    if (aborted) { activeUploads.delete(tempId); notify(); return }
    if (e) { e.status = 'error'; notify() }
    setTimeout(() => { activeUploads.delete(tempId); notify() }, 3000)
    return
  }

  const e = activeUploads.get(tempId)
  if (e) { e.status = 'inserting'; notify() }

  const fileUrl = `${supabaseUrl}/storage/v1/object/public/media/${filePath}`
  const { data } = await supabase.from('messages').insert({
    chat_id: chatId, sender_id: userId, content: caption || '',
    message_type: type, file_url: fileUrl, file_name: file.name, file_size: file.size,
    reply_to: replyToId,
  }).select(`*, sender:profiles!messages_sender_id_profiles_fkey(*), reactions(*)`).single()

  if (data) {
    const realMsg = data as unknown as Message
    const e2 = activeUploads.get(tempId)
    if (e2) { e2.status = 'done'; e2.message = realMsg; notify() }
    window.dispatchEvent(new CustomEvent('chat-list-reload'))
  }

  uploadControllers.delete(tempId)
  setTimeout(() => { activeUploads.delete(tempId); notify() }, 500)
}
