import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import React, { useState } from 'react'
import App from '../src/App'
import { emptyDoc } from '../src/core/types'
import { createEditor } from '../src/editor/schema'
import { openDb as _openDb, saveDoc as _saveDoc } from '../src/storage/db'

afterEach(cleanup)

const refCapture = () => {
  const ref: { ed: Editor | null } = { ed: null }
  const Wrap = (p: { edRef: typeof ref }): React.JSX.Element => {
    const [editor, setEditor] = useState<Editor | null>(null)
    React.useEffect(() => {
      if (editor) p.edRef.ed = editor
    }, [editor]) // eslint-disable-line react-hooks/exhaustive-deps
    return <App doc={emptyDoc()} onEditorReady={setEditor} />
  }
  return <Wrap edRef={ref} />
}

describe('C1: screenplay styling actually renders', () => {
  it('editor host carries the writer paper class', () => {
    const { container } = render(refCapture())
    expect(container.querySelector('.sf-paper') as HTMLElement).toBeTruthy()
  })

  it('ships the logical-indent CSS for every indented element', () => {
    render(refCapture()) // css:true injects the stylesheet
    const styles = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n')
    expect(styles).toContain('.sf-character')
    expect(styles).toContain('55.9mm')
    expect(styles).toContain('.sf-dialogue')
    expect(styles).toContain('25.4mm')
  })
})

describe('I4: pasted paragraph content survives serialization', () => {
  it('rich paste with <p> nodes stays inside block nodes', () => {
    const doc = { ...emptyDoc(), blocks: [{ type: 'action' as const, text: 'already here.' }] }
    const editor = createEditor(doc)
    // paste at the end of the first block
    const end = 1 + 'already here.'.length
    editor.commands.insertContentAt(end, '<p>one pasted</p><p>two pasted</p>')
    const json = editor.getJSON()
    const flat = JSON.stringify(json)
    expect(flat).toContain('one pasted')
    expect(flat).toContain('two pasted')
    expect(flat).toContain('already here.')
    for (const node of json.content ?? []) {
      expect(node.type).toBe('block')
    }
    editor.destroy()
  })
})
