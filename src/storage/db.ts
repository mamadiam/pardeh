import type { ScreenplayDoc } from '../core/types'

// kept from the app's first name (ScreenForge) so scripts already saved in the browser stay
const DB_NAME = 'screenforge'
const DB_VERSION = 1
const STORE = 'scripts'

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    req.onblocked = () => reject(new Error('IndexedDB blocked'))
  })
}

export async function saveDoc(id: string, doc: ScreenplayDoc): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ id, doc })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('save failed'))
      tx.onabort = () => reject(tx.error ?? new Error('save aborted'))
    })
  } finally {
    db.close()
  }
}

export async function deleteDoc(id: string): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('delete failed'))
      tx.onabort = () => reject(tx.error ?? new Error('delete aborted'))
    })
  } finally {
    db.close()
  }
}

export async function listDocIds(): Promise<string[]> {
  const db = await openDb()
  try {
    return await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAllKeys()
      req.onsuccess = () => resolve(req.result.filter((k): k is string => typeof k === 'string'))
      req.onerror = () => reject(req.error ?? new Error('list failed'))
    })
  } finally {
    db.close()
  }
}

export async function loadDoc(id: string): Promise<ScreenplayDoc | null> {
  const db = await openDb()
  try {
    return await new Promise<ScreenplayDoc | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(id)
      req.onsuccess = () => {
        const row = req.result as { doc?: ScreenplayDoc } | undefined
        resolve(row?.doc ?? null)
      }
      req.onerror = () => reject(req.error ?? new Error('load failed'))
    })
  } finally {
    db.close()
  }
}
