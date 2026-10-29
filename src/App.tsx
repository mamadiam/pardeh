import './App.css'
import { useCallback, useEffect, useState } from 'react'
import type { Editor } from '@tiptap/core'
import type { ScreenplayDoc, Direction, ElementType } from './core/types'
import { saveToJson } from './core/serialize'
import { emptyDoc } from './core/types'
import { createEditor, tiptapToDoc } from './editor/schema'
import Toolbar from './ui/Toolbar'
import StatusBar from './ui/StatusBar'
import EditorView from './ui/EditorView'

export default function App(props: {
  doc?: ScreenplayDoc
  onEditorReady?: (editor: Editor) => void
}) {
  const [doc] = useState<ScreenplayDoc>(() => props.doc ?? emptyDoc())
  const [editor] = useState(() => createEditor(doc))
  const [currentElement, setCurrentElement] = useState<ElementType>()
  const [direction, setDirection] = useState<Direction>(doc.direction)
  const [focus, setFocus] = useState(false)

  useEffect(() => {
    const onState = () => {
      const { $head } = editor.state.selection
      if ($head.parent.type.name === 'block') {
        const type = $head.parent.attrs.elementType as ElementType
        if (type !== currentElement) setCurrentElement(type)
      }
    }
    editor.on('selectionUpdate', onState)
    editor.on('update', onState)
    return () => {
      editor.off('selectionUpdate', onState)
      editor.off('update', onState)
    }
  }, [editor, currentElement])

  const onSave = useCallback(() => {
    const json = editor.getJSON()
    const screenplay = tiptapToDoc(json.content ?? [], doc.meta, direction)
    const blob = new Blob([saveToJson(screenplay)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc.meta.title || 'screenplay'}.screenforge`
    a.click()
    URL.revokeObjectURL(url)
  }, [editor, doc, direction])

  return (
    <div className={`sf-app${focus ? ' sf-focus' : ''}`} dir={direction} data-direction={direction}>
      <Toolbar
        editor={editor}
        currentElement={currentElement ?? 'scene'}
        onSave={onSave}
        onFocus={() => setFocus(!focus)}
        focus={focus}
      />
      <EditorView editor={editor} doc={doc} onEditorReady={props.onEditorReady} />
      <StatusBar
        editor={editor}
        currentElement={currentElement ?? 'scene'}
        direction={direction}
        onDirection={setDirection}
      />
    </div>
  )
}
