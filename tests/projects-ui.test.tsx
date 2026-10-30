import { cleanup, render, waitFor, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import React from 'react'
import App from '../src/App'
import { saveDoc } from '../src/storage/db'
import { writeIndex } from '../src/storage/projects'
import { emptyDoc } from '../src/core/types'

function Capture(props: { edRef: { ed: Editor | null } }) {
  const [editor, setEditor] = React.useState<Editor | null>(null)
  React.useEffect(() => {
    if (editor) props.edRef.ed = editor
  }, [editor]) // eslint-disable-line react-hooks/exhaustive-deps
  return <App onEditorReady={setEditor} />
}

afterEach(cleanup)

describe('project header', () => {
  it('clapperboard lists projects and switches records', async () => {
    await saveDoc('current', { ...emptyDoc(), meta: { ...emptyDoc().meta, title: 'First' } })
    await saveDoc('p_two', { ...emptyDoc(), meta: { ...emptyDoc().meta, title: 'Second' } })
    writeIndex({ activeId: 'current', projects: [
      { id: 'current', title: 'First', updatedAt: 1 },
      { id: 'p_two', title: 'Second', updatedAt: 2 },
    ] })
    const edRef = { ed: null as Editor | null }
    render(<Capture edRef={edRef} />)
    await waitFor(() => expect(edRef.ed).not.toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'projects' }))
    expect(screen.getByRole('menuitem', { name: '✓ First' })).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Second' }))
    // editor is rebuilt for the new doc
    await waitFor(() => expect(screen.getByText('Second')).toBeTruthy())

    // typing after the switch saves to the NEW record, not the old one
    await waitFor(() => expect(edRef.ed).not.toBeNull())
    edRef.ed!.commands.setContent({
      type: 'doc',
      content: [{ type: 'block', attrs: { elementType: 'action' }, content: [{ type: 'text', text: 'switched' }] }],
    })
    const { loadDoc } = await import('../src/storage/db')
    await waitFor(async () => expect((await loadDoc('p_two'))?.blocks[0]?.text).toBe('switched'), { timeout: 4000 })
    expect((await loadDoc('current'))?.meta.title).toBe('First')
  })

  it('right-click on the title opens rename; rename persists', async () => {
    await saveDoc('current', { ...emptyDoc(), meta: { ...emptyDoc().meta, title: 'Draft' } })
    writeIndex({ activeId: 'current', projects: [{ id: 'current', title: 'Draft', updatedAt: 1 }] })
    const edRef = { ed: null as Editor | null }
    render(<Capture edRef={edRef} />)
    await waitFor(() => expect(edRef.ed).not.toBeNull())

    fireEvent.contextMenu(screen.getByText('Draft'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    const input = screen.getByLabelText('screenplay title') as HTMLInputElement
    expect(input.value).toBe('Draft')
    fireEvent.change(input, { target: { value: 'Polished Draft' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByText('Polished Draft')).toBeTruthy()
    const { loadDoc } = await import('../src/storage/db')
    await waitFor(async () => expect((await loadDoc('current'))?.meta.title).toBe('Polished Draft'), { timeout: 4000 })
    // index renamed too
    const { readIndex } = await import('../src/storage/projects')
    expect(readIndex()?.projects[0].title).toBe('Polished Draft')
  })
})
