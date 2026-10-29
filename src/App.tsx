import './App.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import type { ScreenplayDoc, Direction, ElementType } from './core/types'
import { saveToJson, loadFromJson } from './core/serialize'
import { emptyDoc } from './core/types'
import { createEditor, tiptapToDoc } from './editor/schema'
import { loadDoc } from './storage/db'
import { useAutosave } from './storage/autosave'
import Toolbar from './ui/Toolbar'
import StatusBar from './ui/StatusBar'
import EditorView from './ui/EditorView'

const CURRENT_KEY = 'current'

export default function App(props: {
  doc?: ScreenplayDoc
  onEditorReady?: (editor: Editor) => void
}) {
  const [doc, setDoc] = useState<ScreenplayDoc | null>(props.doc ?? null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [currentElement, setCurrentElement] = useState<ElementType>()
  const [updates, setUpdates] = useState(0)
  const [focus, setFocus] = useState(false)
  // ref keeps the autosave closure fresh without re-subscribing the editor
  const directionRef = useRef<Direction>('ltr')
  const [direction, setDirection] = useState<Direction>('ltr')

  // load stored doc on first mount; route through loadFromJson so corrupt or
  // legacy records are normalized instead of blanking the editor
  useEffect(() => {
    if (doc || props.doc) return
    loadDoc(CURRENT_KEY)
      .then((stored) =>
        setDoc(
          stored ? loadFromJson(saveToJson(stored)).doc ?? emptyDoc() : emptyDoc(),
        ),
      )
      .catch(() => setDoc(emptyDoc()))
  }, [doc, props.doc])

  // create the editor once the doc is known
  useEffect(() => {
    if (!doc || editor) return
    const ed = createEditor(doc)
    directionRef.current = doc.direction
    setDirection(doc.direction)
    const onState = () => {
      const { $head } = ed.state.selection
      if ($head.parent.type.name === 'block') {
        setCurrentElement($head.parent.attrs.elementType as ElementType)
      }
    }
    ed.on('selectionUpdate', onState)
    ed.on('update', () => {
      onState()
      setUpdates((u) => u + 1)
    })
    setEditor(ed)
    props.onEditorReady?.(ed)
  }, [doc, editor]) // eslint-disable-line react-hooks/exhaustive-deps

  const { status: saveStatus } = useAutosave(
    () =>
      editor
        ? tiptapToDoc(editor.getJSON().content ?? [], doc?.meta ?? emptyDoc().meta, directionRef.current)
        : null,
    CURRENT_KEY,
    [editor, updates],
  )

  const changeDirection = useCallback((dir: Direction) => {
    directionRef.current = dir
    setDirection(dir)
  }, [])

  const onSave = useCallback(() => {
    if (!editor) return
    const screenplay = tiptapToDoc(
      editor.getJSON().content ?? [],
      doc?.meta ?? emptyDoc().meta,
      directionRef.current,
    )
    const blob = new Blob([saveToJson(screenplay)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${screenplay.meta.title || 'screenplay'}.screenforge`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [editor, doc])

  if (!doc || !editor) return null

  return (
    <div
      className={`sf-app${focus ? ' sf-focus' : ''}`}
      dir={direction}
      data-direction={direction}
    >
      <Toolbar
        editor={editor}
        currentElement={currentElement ?? 'scene'}
        onSave={onSave}
        onFocus={() => setFocus((f) => !f)}
        focus={focus}
      />
      <EditorView editor={editor} doc={doc} onEditorReady={props.onEditorReady} />
      <StatusBar
        editor={editor}
        currentElement={currentElement ?? 'scene'}
        direction={direction}
        onDirection={changeDirection}
        saveStatus={saveStatus}
      />
    </div>
  )
}
