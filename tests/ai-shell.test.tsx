import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React, { useState } from 'react'
import type { Editor } from '@tiptap/core'
import App from '../src/App'
import { emptyDoc } from '../src/core/types'

let store: Map<string, string>
beforeEach(() => {
  store = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderApp() {
  const ref: { ed: Editor | null } = { ed: null }
  const Holder = (): React.JSX.Element => {
    const [editor, setEditor] = useState<Editor | null>(null)
    return (
      <>
        <App doc={emptyDoc()} onEditorReady={setEditor} />
        <EditorSnooper editor={editor} />
      </>
    )
  }
  function EditorSnooper(props: { editor: Editor | null }): null {
    if (props.editor) ref.ed = props.editor
    return null
  }
  const utils = render(<Holder />)
  return { ref, utils }
}

describe('ai shell wiring', () => {
  it('keeps the pre-AI editor contract intact', () => {
    renderApp()
    expect(screen.getByRole('combobox')).toBeTruthy()
    expect(screen.getByRole('button', { name: /focus/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /save/i })).toBeTruthy()
    expect(screen.getByLabelText(/writing direction/i)).toBeTruthy()
    expect(screen.getByLabelText(/switch to dark mode|switch to light mode/i)).toBeTruthy()
  })

  it('opens AI settings from the gear, saves a config, closes', async () => {
    const { ref, utils } = renderApp()
    await waitFor(() => expect(ref.ed).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /open ai settings/i }))
    const dialog = await screen.findByRole('dialog', { name: /ai settings/i })
    expect(dialog).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: /^save$/i }))
    expect(screen.queryByRole('dialog', { name: /ai settings/i })).toBeNull()
    utils.unmount()
  })

  it('opens the breakdown from the toolbar; shows the no-provider state', async () => {
    const { ref, utils } = renderApp()
    await waitFor(() => expect(ref.ed).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /breakdown/i }))
    expect(await screen.findByText(/no provider configured/i)).toBeTruthy()
    utils.unmount()
    void screen
  })
})
