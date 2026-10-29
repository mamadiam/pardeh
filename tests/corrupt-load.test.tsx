import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import React, { useState } from 'react'
import App from '../src/App'
import { saveDoc } from '../src/storage/db'

afterEach(cleanup)

function AppWithCapture(
  props: { editor: { ed: Editor | null } },
): React.JSX.Element {
  const [editor, setEditor] = useState<Editor | null>(null)
  React.useEffect(() => {
    if (editor) props.editor.ed = editor
  }, [editor]) // eslint-disable-line react-hooks/exhaustive-deps
  return <App onEditorReady={setEditor} />
}

describe('I2: corrupt stored record must not blank the app', () => {
  it('loads with a normalized empty doc when the stored record is missing blocks', async () => {
    await saveDoc('current', { junk: true } as never)
    const ed = { ed: null }
    const { container } = render(<AppWithCapture editor={ed} />)
    // if this render survives and the editor mounts, the guard worked
    await waitFor(() => expect(container.querySelector('.sf-app')).toBeTruthy(), { timeout: 4000 })
    expect(ed.ed).not.toBeNull()
  })
})
