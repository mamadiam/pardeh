import '../editor/blocks.css'
import { EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import type { ScreenplayDoc } from '../core/types'
import { useCallback, useEffect, useState } from 'react'
import type { RewriteKind } from '../ai/rewrite'
import { rewriteSelection } from '../ai/rewrite'
import { AiError } from '../ai/client'
import { SelectionMenu } from './SelectionMenu'

interface MenuState {
  rect: { top: number; left: number }
  from: number
  to: number
}

export default function EditorView(props: {
  editor: Editor
  doc: ScreenplayDoc
  onEditorReady?: (editor: Editor) => void
}) {
  const { editor, onEditorReady } = props
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onEditorReady?.(editor)
  }, [editor, onEditorReady])

  // selection → floating rewrite menu (text selections inside the paper only)
  useEffect(() => {
    const onSelectionChange = () => {
      if (pending) return
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !editor.view.dom.contains(sel.anchorNode)) {
        setMenu(null)
        return
      }
      if (sel.toString().trim() === '') {
        setMenu(null)
        return
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      setMenu({ rect: { top: rect.top - 44, left: rect.left }, from: 0, to: 0 })
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange)
    }
  }, [editor, pending])

  const runRewrite = useCallback(
    async (kind: RewriteKind | 'custom', instruction?: string) => {
      if (!menu) return
      setPending(true)
      setError(null)
      try {
        await rewriteSelection(editor, kind, { customInstruction: instruction })
        setMenu(null)
      } catch (e) {
        setError(e instanceof AiError || e instanceof Error ? e.message : 'Something went wrong')
        setPending(false)
        // keep the menu open for the Retry affordance
        return
      }
      setPending(false)
    },
    [editor, menu],
  )

  return (
    <div className="sf-editor-host sf-paper" data-direction={props.doc.direction} data-ui="screenplay-paper">
      <EditorContent editor={editor} />
      {menu && (
        <SelectionMenu
          rect={menu.rect}
          pending={pending}
          error={error}
          onClose={() => {
            setMenu(null)
            setError(null)
          }}
          onRewrite={runRewrite}
        />
      )}
    </div>
  )
}
