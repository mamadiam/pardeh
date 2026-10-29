import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/core'
import React, { useState } from 'react'
import { emptyDoc } from '../src/core/types'

// storage failure: openDb rejects and saveDoc must never be reached successfully
vi.mock('../src/storage/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/storage/db')>()
  return {
    ...actual,
    openDb: vi.fn(async () => {
      throw new Error('no storage in private mode')
    }),
  }
})

import App from '../src/App'

afterEach(cleanup)

describe('I1: autosave failure is surfaced in the status bar', () => {
  it('shows "unsaved — storage error" after a failed save, editor still mounted', async () => {
    const ref: { ed: Editor | null } = { ed: null }
    const Wrap = (): React.JSX.Element => {
      const [editor, setEditor] = useState<Editor | null>(null)
      React.useEffect(() => {
        if (editor) ref.ed = editor
      }, [editor])
      return <App doc={emptyDoc()} onEditorReady={setEditor} />
    }
    const { container } = render(<Wrap />)
    // simulate an edit so autosave fires
    await waitFor(() => expect(ref.ed).not.toBeNull())
    ;(ref.ed as Editor).commands.insertContent('some words')
    await waitFor(
      () => {
        expect(screen.getByText(/unsaved — storage error/i)).toBeTruthy()
      },
      { timeout: 4000 },
    )
    // editor remains mounted and interactive
    expect(container.querySelector('[role="textbox"]')).toBeTruthy()
  })
})
