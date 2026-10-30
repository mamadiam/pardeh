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
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('sf-theme') === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })

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

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'light' ? 'dark' : 'light'
      try {
        localStorage.setItem('sf-theme', next)
      } catch {
        // storage may be unavailable; the session keeps the choice
      }
      return next
    })
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
      data-theme={theme}
    >
      <header className="sf-topbar">
        <span className="sf-badge" aria-hidden="true">
          {/* the mark: a clapperboard, drawn from the product's object */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="9.5" width="19" height="11.5" rx="1.5" />
            <path d="M3 9.5 4.8 4.6a1 1 0 0 1 1.3-.6l14.2 4.2-.6 1.3" />
            <path d="M8.3 9.3l1.6-4.9M13.9 9.6l1.6-4.9" />
          </svg>
        </span>
        <h1 className="sf-doc-title">{doc.meta.title || 'Untitled screenplay'}</h1>
        <span className="sf-divider" aria-hidden="true" />
        <Toolbar
          editor={editor}
          currentElement={currentElement ?? 'scene'}
          onSave={onSave}
          onFocus={() => setFocus((f) => !f)}
          focus={focus}
        />
        <span className="sf-spacer" />
        <StatusBar
          editor={editor}
          currentElement={currentElement ?? 'scene'}
          direction={direction}
          onDirection={changeDirection}
          saveStatus={saveStatus}
          theme={theme}
          onTheme={toggleTheme}
        />
      </header>
      <main className="sf-canvas">
        <EditorView editor={editor} doc={doc} onEditorReady={props.onEditorReady} />
      </main>
    </div>
  )
}
