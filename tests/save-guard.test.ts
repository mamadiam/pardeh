import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { loadDoc } from '../src/storage/db'
import { useAutosave } from '../src/storage/autosave'
import { emptyDoc, type ScreenplayDoc } from '../src/core/types'

describe('I3: autosave must not overwrite storage before the editor exists', () => {
  it('skips the save entirely while getDoc() returns null', async () => {
    let snapshot: ScreenplayDoc | null = null // editor not ready
    const { result, rerender } = renderHook(() =>
      useAutosave(() => snapshot, 'save-guard', [snapshot]),
    )
    // wait past the debounce
    rerender()
    await new Promise((r) => setTimeout(r, 1200))
    expect(result.current.status).toBe('pending')
    expect(await loadDoc('save-guard')).toBeNull()

    // then the editor becomes ready and the save proceeds
    const ready = emptyDoc()
    snapshot = ready
    rerender()
    await waitFor(() => expect(result.current.status).toBe('saved'), { timeout: 3000 })
    expect(await loadDoc('save-guard')).toEqual(ready)
  })
})
