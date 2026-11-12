import { useEffect, useState } from 'react'
import type { RewriteKind } from '../ai/rewrite'
import { useT } from '../i18n'

const ACTIONS: Exclude<RewriteKind, 'custom'>[] = ['Polish', 'Shorten', 'Expand']

// clamp the floating menu inside the viewport (I3)
export function menuPosition(
  rect: { top: number; left: number; width: number; height: number },
  viewportWidth: number,
): { top: number; left: number } {
  const top = Math.max(8, Math.min(rect.top - 48, window.innerHeight - rect.height - 48))
  const left = Math.max(8, Math.min(rect.left, viewportWidth - rect.width - 8))
  return { top, left }
}

export function SelectionMenu(props: {
  rect: { top: number; left: number }
  pending: boolean
  error: string | null
  onClose: () => void
  onRewrite: (kind: RewriteKind | 'custom', instruction?: string) => void
}) {
  const [custom, setCustom] = useState('')
  const t = useT()

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
      aria-label={t('rewrite.menu')}
      // keep the DOM selection alive: clicking the menu must not collapse it
      onMouseDown={(e) => e.preventDefault()}
    >
      {props.pending ? (
        <span className="sf-rewrite-pending">{t('rewrite.pending')}</span>
      ) : props.error ? (
        <>
          <span className="sf-rewrite-error">{props.error}</span>
          {ACTIONS.map((a) => (
            <button key={a} type="button" role="menuitem" onClick={() => props.onRewrite(a)}>
              {t(`rewrite.${a}`)}
            </button>
          ))}
        </>
      ) : (
        <>
          {ACTIONS.map((a) => (
            <button key={a} type="button" role="menuitem" onClick={() => props.onRewrite(a)}>
              {t(`rewrite.${a}`)}
            </button>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (custom.trim()) props.onRewrite('custom', custom.trim())
            }}
          >
            <input
              aria-label={t('rewrite.customLabel')}
              placeholder={t('rewrite.custom')}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </form>
        </>
      )}
    </div>
  )
}
