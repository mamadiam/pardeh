import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import type { Editor } from '@tiptap/core'
import React from 'react'
import App from '../src/App'

interface EditorRef {
  ed: Editor | null
}

function AppWithCapture(
  props: { onReady: (editor: Editor) => void; editorRef: EditorRef },
): React.JSX.Element {
  const [editor, setEditor] = React.useState<Editor | null>(null)
  React.useEffect(() => {
    if (editor) {
      props.onReady(editor)
      props.editorRef.ed = editor
    }
  }, [editor]) // eslint-disable-line react-hooks/exhaustive-deps
  return <App onEditorReady={setEditor} />
}

afterEach(cleanup)

describe('phase 1 whole flow: type, autosave, reload', () => {
  it('persists typed content across a fresh App mount', async () => {
    const firstRef: EditorRef = { ed: null }
    const first = render(
      <AppWithCapture onReady={() => {}} editorRef={firstRef} />,
    )
    await waitFor(() => expect(firstRef.ed).not.toBeNull())
    const ed = firstRef.ed!

    // "type" the opening scene heading
    ed.commands.setContent({
      type: 'doc',
      content: [
        { type: 'block', attrs: { elementType: 'scene' }, content: [{ type: 'text', text: 'INT. HOUSE - NIGHT' }] },
      ],
    })
    // cursor at end of line, then Enter → new action block
    ed.commands.setTextSelection(1 + 'INT. HOUSE - NIGHT'.length)
    expect(ed.commands.smartEnter()).toBe(true)
    ed.commands.insertContent('The lights flicker.')

    // wait until autosave lands
    await waitFor(
      async () => {
        const stored = await import('../src/storage/db').then((m) => m.loadDoc('current'))
        expect(stored?.blocks.some((b) => b.text === 'The lights flicker.')).toBe(true)
      },
      { timeout: 4000 },
    )
    first.unmount()

    // fresh mount = reload simulation
    const secondRef: EditorRef = { ed: null }
    const second = render(
      <AppWithCapture onReady={() => {}} editorRef={secondRef} />,
    )
    await waitFor(() => expect(secondRef.ed).not.toBeNull(), { timeout: 4000 })
    const edr = secondRef.ed!
    await waitFor(() => {
      const blocks = (edr.getJSON().content ?? []).filter((n) => n.type === 'block')
      expect((blocks[0].attrs as { elementType?: string }).elementType).toBe('scene')
      expect(blocks[0].content?.[0]?.text).toBe('INT. HOUSE - NIGHT')
      expect((blocks[1].attrs as { elementType?: string }).elementType).toBe('action')
      expect(blocks[1].content?.[0]?.text).toBe('The lights flicker.')
    }, { timeout: 4000 })
    second.unmount()
  })
})
