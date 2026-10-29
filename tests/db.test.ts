import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { loadDoc, saveDoc } from '../src/storage/db'
import { useAutosave } from '../src/storage/autosave'
import { emptyDoc, type ScreenplayDoc } from '../src/core/types'

const doc: ScreenplayDoc = {
  ...emptyDoc(),
  meta: { ...emptyDoc().meta, title: 'تست' },
  direction: 'rtl',
  blocks: [{ type: 'scene', text: 'داخلی. خانه - شب' }],
}

describe('db', () => {
  it('saves and loads a document round trip', async () => {
    await saveDoc('test-1', doc)
    const loaded = await loadDoc('test-1')
    expect(loaded).toEqual(doc)
  })

  it('returns null for a missing id', async () => {
    expect(await loadDoc('nope')).toBeNull()
  })

  it('overwrites an existing id', async () => {
    const blank = emptyDoc()
    await saveDoc('test-2', doc)
    await saveDoc('test-2', blank)
    expect(await loadDoc('test-2')).toEqual(blank)
  })
})

describe('useAutosave', () => {
  it('debounces and marks saved after a disk write', async () => {
    let snapshot: ScreenplayDoc = doc
    const getDoc = () => snapshot
    const { result, rerender } = renderHook(() => useAutosave(getDoc, 'autosave-1', []))
    expect(result.current.status).toBe('pending')
    // simulate an edit
    snapshot = { ...doc, blocks: [{ type: 'action', text: 'changed' }] }
    rerender()
    await waitFor(() => expect(result.current.status).toBe('saved'), { timeout: 2000 })
    expect(await loadDoc('autosave-1')).toEqual(snapshot)
  })

  it('degrades to error status when storage rejects, without throwing', async () => {
    let snapshot: ScreenplayDoc = doc
    const getDoc = () => snapshot
    const { result, rerender } = renderHook(() => useAutosave(getDoc, 'autosave-err', [], {
      openDbOverride: async () => {
        throw new Error('no storage')
      },
    }))
    snapshot = { ...doc, blocks: [{ type: 'action', text: 'edit' }] }
    rerender()
    await waitFor(() => expect(result.current.status).toBe('error'), { timeout: 2000 })
    // editing continues: hook is still mounted and usable
    expect(result.current.status).toBe('error')
  })
})

export {}
