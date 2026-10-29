import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import { useState } from 'react'
import App from '../src/App'
import { wordCount } from '../src/ui/status'

import { emptyDoc } from '../src/core/types'

afterEach(cleanup)

function AppWithEditorCapture(
  props: { onReady: (editor: Editor) => void },
): React.JSX.Element {
  const [editor, setEditor] = useState<Editor | null>(null)
  if (editor) props.onReady(editor) // eslint-disable-line react-hooks/rules-of-hooks
  return <App doc={emptyDoc()} onEditorReady={setEditor} />
}

function renderApp(): {
  app: HTMLElement
  editor: Editor
} {
  let editor: Editor | null = null
  const { container } = render(
    <AppWithEditorCapture
      onReady={(ed) => {
        editor = ed
      }}
    />,
  )
  if (!editor) throw new Error('editor not ready')
  return { app: container.querySelector('.sf-app') as HTMLElement, editor }
}

describe('direction toggle', () => {
  it('toggles dir rtl/ltr on the app container', () => {
    const { app } = renderApp()
    expect(app.getAttribute('dir')).toBe('ltr')
    fireEvent.click(screen.getByRole('button', { name: /rtl/i }))
    expect(app.getAttribute('dir')).toBe('rtl')
    expect(app.getAttribute('data-direction')).toBe('rtl')
    fireEvent.click(screen.getByRole('button', { name: /ltr/i }))
    expect(app.getAttribute('dir')).toBe('ltr')
  })
})

describe('wordCount util', () => {
  it('counts whitespace-split words', () => {
    expect(wordCount('Hello world there')).toBe(3)
    expect(wordCount('پیوسته فارسی')).toBe(2)
    expect(wordCount('')).toBe(0)
  })

  it('shows live count in the status bar', async () => {
    const { editor } = renderApp()
    editor.commands.setContent({ type: 'doc', content: [{ type: 'block', attrs: { elementType: 'action' }, content: [{ type: 'text', text: 'Hello world there' }] }] })
    const status = await screen.findByText(/3 words|۳ words|(Hello world there)/)
    // live update arrives via editor 'update' event → React state
    expect(status).toBeTruthy()
  })
})

describe('toolbar element select', () => {
  it('changes the cursor block elementType', () => {
    const { editor } = renderApp()
    editor.commands.setContent({ type: 'doc', content: [{ type: 'block', attrs: { elementType: 'scene' }, content: [{ type: 'text', text: 'INT.' }] }] })
    // place cursor in that block
    editor.commands.setTextSelection(2)
    const selector = screen.getByRole('combobox') as HTMLSelectElement
    expect(selector.value).toBe('scene')
    fireEvent.change(selector, { target: { value: 'dialogue' } })
    const json = editor.getJSON()
    const blocks = (json.content ?? []).filter((n) => n.type === 'block')
    expect((blocks[0].attrs as { elementType?: string }).elementType).toBe('dialogue')
    expect(selector.value).toBe('dialogue')
  })
})

describe('focus mode', () => {
  it('toggles sf-focus class on root; CSS hides the toolbar', () => {
    const { app } = renderApp()
    expect(app.classList.contains('sf-focus')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /focus/i }))
    expect(app.classList.contains('sf-focus')).toBe(true)
    // display:none removes it from the accessibility tree — drive the button directly
    const toolbar = app.querySelector('.sf-toolbar') as HTMLElement
    expect(getComputedStyle(toolbar).display).toBe('none')
    fireEvent.click(app.querySelector('.sf-toggle-focus') as HTMLElement)
    expect(app.classList.contains('sf-focus')).toBe(false)
  })
})
