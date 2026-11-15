import { useEffect, useRef, type ReactNode } from 'react'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal shell for every panel: scrim, Escape to close, focus moved inside on open
 * and back to the trigger on close, and Tab kept inside while it is open.
 * `className` replaces the panel class; it defaults to `sf-ai-settings`.
 */
export default function Dialog(props: { label: string; onClose: () => void; className?: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(props.onClose)

  useEffect(() => {
    close.current = props.onClose
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const el = panel.current
    if (el && !el.contains(document.activeElement)) {
      const first = el.querySelector<HTMLElement>(FOCUSABLE) ?? el
      first.focus()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close.current()
        return
      }
      if (e.key !== 'Tab' || !el) return
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (items.length === 0) return
      const head = items[0]
      const tail = items[items.length - 1]
      if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault()
        head.focus()
      } else if (e.shiftKey && document.activeElement === head) {
        e.preventDefault()
        tail.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [])

  return (
    <div className="sf-ai-overlay" role="dialog" aria-modal="true" aria-label={props.label}>
      <div className={props.className ?? 'sf-ai-settings'} ref={panel}>
        {props.children}
      </div>
    </div>
  )
}
