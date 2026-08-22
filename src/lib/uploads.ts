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

async function uploadWithProgress(bucket: string, path: string, body: Blob, onProgress: (pct: number) => void): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token || supabaseAnonKey

  const CHUNK_SIZE = 5 * 1024 * 1024
  const totalChunks = Math.ceil(body.size / CHUNK_SIZE)

  if (totalChunks <= 1) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) { onProgress(100); resolve(path) }
        else reject(new Error(`Upload failed: ${xhr.status}`))
      }
      xhr.onerror = () => reject(new Error('Network error'))
      xhr.open('POST', `${supabaseUrl}/storage/v1/object/${bucket}/${path}`)
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
      xhr.setRequestHeader('Content-Type', body.type || 'application/octet-stream')
      xhr.send(body)
    })
  }

  const uploadIdRes = await fetch(`${supabaseUrl}/storage/v1/upload/resumable`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Upstash-Meta': JSON.stringify({ bucketName: bucket, objectName: path }),
    },
    body: JSON.stringify({}),
  }).catch(() => null)

  if (!uploadIdRes || !uploadIdRes.ok) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) { onProgress(100); resolve(path) }
        else reject(new Error(`Upload failed: ${xhr.status}`))
      }
      xhr.onerror = () => reject(new Error('Network error'))
      xhr.open('POST', `${supabaseUrl}/storage/v1/object/${bucket}/${path}`)
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
      xhr.setRequestHeader('Content-Type', body.type || 'application/octet-stream')
      xhr.send(body)
    })
  }

  let uploadedBytes = 0
  const PARALLEL = 3
  let chunkIndex = 0

  async function uploadChunk(idx: number): Promise<boolean> {
    if (idx >= totalChunks) return false
    const start = idx * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, body.size)
    const chunk = body.slice(start, end)

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${supabaseUrl}/storage/v1/upload/resumable`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': body.type || 'application/octet-stream',
            'Content-Range': `bytes ${start}-${end - 1}/${body.size}`,
          },
          body: chunk,
        })
        if (res.ok) {
          uploadedBytes += (end - start)
          onProgress(Math.round((uploadedBytes / body.size) * 100))
          return true
        }
        if (res.status === 409) {
          uploadedBytes = end
          onProgress(Math.round((uploadedBytes / body.size) * 100))
          return true
        }
      } catch {}
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
    }
    throw new Error(`Chunk ${idx} failed after 3 attempts`)
  }

  const workers: Promise<void>[] = []
  for (let i = 0; i < PARALLEL; i++) {
    workers.push((async () => {
      while (chunkIndex < totalChunks) {
        const myIdx = chunkIndex++
        await uploadChunk(myIdx)
      }
    })())
  }
  await Promise.all(workers)
  onProgress(100)
  return path
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
  notify()

  let filePath: string
  try {
    const pathExt = uploadName.split('.').pop() || ext
    const compressedName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${pathExt}`
    filePath = await uploadWithProgress('media', compressedName, uploadFile, (pct) => {
      const e = activeUploads.get(tempId)
      if (e) { e.progress = pct; notify() }
    })
  } catch {
    const e = activeUploads.get(tempId)
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

  setTimeout(() => { activeUploads.delete(tempId); notify() }, 500)
}
