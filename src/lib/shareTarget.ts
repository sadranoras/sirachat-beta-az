const DB_NAME = 'sirachat-share-target'
const STORE = 'shared-files'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function takeSharedFiles(): Promise<File[]> {
  if (typeof indexedDB === 'undefined') return []
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.getAll()
    req.onsuccess = () => {
      const rows = req.result || []
      rows.forEach(row => store.delete(row.id))
      resolve(rows.map((row: any) => new File([row.blob], row.name, { type: row.type || row.blob?.type || 'application/octet-stream', lastModified: row.lastModified || Date.now() })))
    }
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
    tx.onerror = () => reject(tx.error)
  })
}
