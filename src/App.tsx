import './App.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import type { ScreenplayDoc, Direction, ElementType } from './core/types'
import { saveToJson, loadFromJson } from './core/serialize'
import { emptyDoc } from './core/types'
import { createEditor, tiptapToDoc } from './editor/schema'
import { deleteDoc, loadDoc, saveDoc } from './storage/db'
import {
  addProject,
  ensureIndex,
  removeProject,
  renameProject,
  setActive,
  writeIndex,
  type ProjectIndex,
} from './storage/projects'
import { useAutosave } from './storage/autosave'
import AiSettings from './ui/AiSettings'
import BreakdownPanel from './ui/BreakdownPanel'
import { FloatingMenu, type MenuItem } from './ui/FloatingMenu'
import Toolbar from './ui/Toolbar'
import StatusBar from './ui/StatusBar'
import EditorView from './ui/EditorView'

const CURRENT_KEY = 'current'

interface HeaderMenu {
  x: number
  y: number
  kind: 'title' | 'projects'
}

export default function App(props: {
  doc?: ScreenplayDoc
  onEditorReady?: (editor: Editor) => void
}) {
  const [doc, setDoc] = useState<ScreenplayDoc | null>(props.doc ?? null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [activeId, setActiveId] = useState(CURRENT_KEY)
  const [projects, setProjects] = useState<ProjectIndex | null>(null)
  const [headerMenu, setHeaderMenu] = useState<HeaderMenu | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
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

  // index: migrate-or-read once; the doc itself loads per activeId below
  useEffect(() => {
    let alive = true
    ensureIndex()
      .then((idx) => {
        if (!alive) return
        setProjects(idx)
        if (idx.activeId && !props.doc) setActiveId(idx.activeId)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [props.doc])

  // (re)load the stored doc whenever the open project changes; corrupt or
  // legacy records are normalized instead of blanking the editor
  useEffect(() => {
    if (props.doc) return
    let alive = true
    loadDoc(activeId)
      .then((stored) => {
        if (alive) setDoc(stored ? loadFromJson(saveToJson(stored)).doc ?? emptyDoc() : emptyDoc())
      })
      .catch(() => {
        if (alive) setDoc(emptyDoc())
      })
    return () => {
      alive = false
    }
  }, [activeId, props.doc])

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
    activeId,
    [editor, updates, activeId],
  )

  const updateIndex = useCallback((fn: (idx: ProjectIndex) => ProjectIndex) => {
    setProjects((idx) => {
      if (!idx) return idx
      const next = fn(idx)
      writeIndex(next)
      return next
    })
  }, [])

  // flush the live editor into the record the autosave debounce hasn't
  // reached yet, so switching projects can never lose the last keystrokes
  const flushEditor = useCallback(() => {
    if (!editor || !doc) return
    const snapshot = tiptapToDoc(editor.getJSON().content ?? [], doc.meta, directionRef.current)
    void saveDoc(activeId, snapshot)
  }, [editor, doc, activeId])

  const switchProject = useCallback(
    (id: string) => {
      if (id === activeId) return
      flushEditor()
      setEditor(null)
      setDoc(null)
      setActiveId(id)
      updateIndex((idx) => setActive(idx, id))
    },
    [activeId, flushEditor, updateIndex],
  )

  const newProject = useCallback(() => {
    const id = `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    flushEditor()
    const fresh = emptyDoc()
    void saveDoc(id, fresh)
    setEditor(null)
    setDoc(fresh)
    setActiveId(id)
    updateIndex((idx) => addProject(setActive(idx, id), id, ''))
  }, [flushEditor, updateIndex])

  const removeProjectById = useCallback(
    (id: string) => {
      void deleteDoc(id)
      const rest = projects?.projects.filter((p) => p.id !== id) ?? []
      const nextId = rest[0]?.id
      setEditor(null)
      setDoc(null)
      updateIndex((idx) => {
        const dropped = removeProject(idx, id)
        return nextId ? setActive(dropped, nextId) : dropped
      })
      if (id === activeId) {
        if (nextId) {
          setActiveId(nextId)
        } else {
          // last project removed — start a fresh one
          const nid = `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
          const fresh = emptyDoc()
          void saveDoc(nid, fresh)
          setActiveId(nid)
          setProjects((idx) => {
            const next = addProject({ activeId: nid, projects: idx?.projects ?? [] }, nid, '')
            writeIndex(next)
            return next
          })
        }
      }
    },
    [projects, activeId, updateIndex],
  )

  const beginRename = useCallback(() => {
    setDraftTitle(doc?.meta.title ?? '')
    setRenaming(true)
  }, [doc])

  const commitRename = useCallback(() => {
    setRenaming(false)
    const title = draftTitle.trim()
    if (!doc || title === (doc.meta.title || '')) return
    const next = { ...doc, meta: { ...doc.meta, title } }
    setDoc(next)
    void saveDoc(activeId, next)
    updateIndex((idx) => renameProject(idx, activeId, title))
  }, [doc, draftTitle, activeId, updateIndex])

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

  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const closeAiSettings = useCallback(() => {
    setAiSettingsOpen(false)
  }, [])
  const openBreakdownSettings = useCallback(() => {
    setBreakdownOpen(false)
    setAiSettingsOpen(true)
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
        <button
          type="button"
          className="sf-badge"
          aria-label="projects"
          aria-haspopup="menu"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setHeaderMenu({ x: r.left, y: r.bottom + 4, kind: 'projects' })
          }}
        >
          {/* the mark: a clapperboard, drawn from the product's object */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="9.5" width="19" height="11.5" rx="1.5" />
            <path d="M3 9.5 4.8 4.6a1 1 0 0 1 1.3-.6l14.2 4.2-.6 1.3" />
            <path d="M8.3 9.3l1.6-4.9M13.9 9.6l1.6-4.9" />
          </svg>
        </button>
        {renaming ? (
          <input
            className="sf-title-input"
            aria-label="screenplay title"
            value={draftTitle}
            autoFocus
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setRenaming(false)
            }}
            onBlur={commitRename}
          />
        ) : (
          <h1
            className="sf-doc-title"
            onContextMenu={(e) => {
              e.preventDefault()
              setHeaderMenu({ x: e.clientX, y: e.clientY, kind: 'title' })
            }}
          >
            {doc.meta.title || 'Untitled screenplay'}
          </h1>
        )}
        <span className="sf-divider" aria-hidden="true" />
        <Toolbar
          editor={editor}
          currentElement={currentElement ?? 'scene'}
          onSave={onSave}
          onFocus={() => setFocus((f) => !f)}
          focus={focus}
          onBreakdown={() => setBreakdownOpen(true)}
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
          onOpenAiSettings={() => setAiSettingsOpen(true)}
        />
      </header>
      <main className="sf-canvas">
        <EditorView editor={editor} doc={doc} onEditorReady={props.onEditorReady} />
      </main>
      <AiSettings open={aiSettingsOpen} onClose={closeAiSettings} />
      <BreakdownPanel
        open={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        doc={doc}
        onOpenSettings={openBreakdownSettings}
      />
      {headerMenu && (
        <FloatingMenu
          x={headerMenu.x}
          y={headerMenu.y}
          onClose={() => setHeaderMenu(null)}
          items={
            headerMenu.kind === 'projects'
              ? [
                  ...(projects?.projects ?? []).map((p) => ({
                    label: p.id === activeId ? `✓ ${p.title || 'Untitled screenplay'}` : p.title || 'Untitled screenplay',
                    onSelect: () => switchProject(p.id),
                  })),
                  { label: 'New screenplay', onSelect: newProject },
                ]
              : ([
                  { label: 'Rename', onSelect: beginRename },
                  { label: 'Export', onSelect: onSave },
                  { label: 'Remove project', onSelect: () => removeProjectById(activeId), danger: true },
                ] as MenuItem[])
          }
        />
      )}
    </div>
  )
}
