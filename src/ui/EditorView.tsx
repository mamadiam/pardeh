import './EditorView.css'
import { EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import type { ScreenplayDoc } from '../core/types'
import { useEffect } from 'react'

export default function EditorView(props: {
  editor: Editor
  doc: ScreenplayDoc
  onEditorReady?: (editor: Editor) => void
}) {
  const { editor, doc, onEditorReady } = props
  useEffect(() => {
    onEditorReady?.(editor)
  }, [editor, onEditorReady])
  return (
    <div className="sf-editor-host" data-direction={props.doc.direction}>
      <EditorContent editor={editor} />
    </div>
  )
}
