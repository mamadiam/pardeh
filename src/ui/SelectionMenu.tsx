import { useEffect, useState } from 'react'
import type { RewriteKind } from '../ai/rewrite'

const ACTIONS: Exclude<RewriteKind, 'custom'>[] = ['Polish', 'Shorten', 'Expand']

export function SelectionMenu(props: {
  rect: { top: number; left: number }
  pending: boolean
  error: string | null
  onClose: () => void
  onRewrite: (kind: RewriteKind | 'custom', instruction?: string) => void
}) {
  const [custom, setCustom] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props])

  return (
    <div
      className="sf-selection-menu"
      style={{ top: props.rect.top, left: props.rect.left }}
      role="menu"
      aria-label="rewrite selection"
    >
      {props.pending ? (
        <span className="sf-rewrite-pending">Rewriting…</span>
      ) : props.error ? (
        <>
          <span className="sf-rewrite-error">{props.error}</span>
        </>
      ) : (
        <>
          {ACTIONS.map((a) => (
            <button key={a} type="button" role="menuitem" onClick={() => props.onRewrite(a)}>
              {a}
            </button>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (custom.trim()) props.onRewrite('custom', custom.trim())
            }}
          >
            <input
              aria-label="custom instruction"
              placeholder="Custom instruction"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </form>
        </>
      )}
    </div>
  )
}
