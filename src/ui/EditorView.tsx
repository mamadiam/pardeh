import '../editor/blocks.css'
import { EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import type { ScreenplayDoc } from '../core/types'
import { useCallback, useEffect, useState } from 'react'
import type { RewriteKind } from '../ai/rewrite'
import { rewriteSelection } from '../ai/rewrite'
import { AiError } from '../ai/client'
import { menuPosition, SelectionMenu } from './SelectionMenu'
import { useT } from '../i18n'

interface MenuState {
  rect: { top: number; left: number }
  range: { from: number; to: number }
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
  const t = useT()

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
      // capture the range NOW — the selection may have changed by click time
      const pm = editor.state.selection
      setMenu({
        rect: menuPosition({ top: rect.top, left: rect.left, width: rect.width, height: rect.height }, window.innerWidth),
        range: { from: Math.min(pm.from, pm.to), to: Math.max(pm.from, pm.to) },
      })
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
        await rewriteSelection(editor, kind, { customInstruction: instruction, range: menu.range })
        setMenu(null)
      } catch (e) {
        setError(e instanceof AiError || e instanceof Error ? e.message : t('editor.genericError'))
        setPending(false)
        // keep the menu open for the Retry affordance
        return
      }
      setPending(false)
    },
    [editor, menu, t],
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
