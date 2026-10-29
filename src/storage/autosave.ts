import { useEffect, useState } from 'react'
import type { ScreenplayDoc } from '../core/types'
import { saveDoc, openDb } from './db'

type AutosaveStatus = 'saved' | 'error' | 'pending'

export interface AutosaveOptions {
  openDbOverride?: typeof openDb
  saveDocOverride?: typeof saveDoc
  debounceMs?: number
}

const DEBOUNCE_MS = 800

export function useAutosave(
  getDoc: () => ScreenplayDoc,
  id: string,
  deps: unknown[],
  options: AutosaveOptions = {},
): { status: AutosaveStatus } {
  const [status, setStatus] = useState<AutosaveStatus>('pending')
  const saver = options.saveDocOverride ?? saveDoc
  const opener = options.openDbOverride ?? openDb
  const debounceMs = options.debounceMs ?? DEBOUNCE_MS

  useEffect(() => {
    const timer = setTimeout(() => {
      let db: PromiseLike<IDBDatabase> | undefined
      try {
        db = opener()
      } catch {
        setStatus('error')
        return
      }
      Promise.resolve(db)
        .then(() => saver(id, getDoc()))
        .then(() => setStatus('saved'))
        .catch(() => setStatus('error'))
    }, debounceMs)
    return () => clearTimeout(timer)
    // deps drive re-saves; eslint-disable because callers pass dynamic deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, debounceMs, ...deps])

  return { status }
}

export type { AutosaveStatus }
