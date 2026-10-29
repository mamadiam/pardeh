import { useEffect, useState } from 'react'
import type { ScreenplayDoc } from '../core/types'
import { saveDoc, openDb } from './db'

export type AutosaveStatus = 'saved' | 'error' | 'pending'

export interface AutosaveOptions {
  openDbOverride?: typeof openDb
  saveDocOverride?: typeof saveDoc
  debounceMs?: number
}

const DEBOUNCE_MS = 800

export function useAutosave(
  getDoc: () => ScreenplayDoc | null,
  id: string,
  deps: unknown[],
  options: AutosaveOptions = {},
): { status: AutosaveStatus } {
  const [status, setStatus] = useState<AutosaveStatus>('pending')
  const saver = options.saveDocOverride ?? saveDoc
  const opener = options.openDbOverride ?? openDb
  const debounceMs = options.debounceMs ?? DEBOUNCE_MS

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const run = () => {
      const doc = getDoc()
      // editor not mounted yet — never write storage; an unready save
      // could overwrite a resumable script with a blank document
      if (!doc) {
        setStatus('pending')
        timer = setTimeout(run, debounceMs)
        return
      }
      let dbPromise: PromiseLike<IDBDatabase> | undefined
      try {
        dbPromise = opener()
      } catch {
        setStatus('error')
        return
      }
      Promise.resolve(dbPromise)
        .then(() => saver(id, doc))
        .then(() => setStatus('saved'))
        .catch(() => setStatus('error'))
    }
    timer = setTimeout(run, debounceMs)
    // shortcut: pending saves are not flushed on tab close; some final
    // keystrokes can be lost (visibilitychange flush when it matters)
    return () => clearTimeout(timer)
    // deps drive re-saves; callers pass dynamic deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, debounceMs, ...deps])

  return { status }
}
