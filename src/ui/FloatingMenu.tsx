import { useEffect, useRef } from 'react'

export interface MenuItem {
  label: string
  onSelect: () => void
  danger?: boolean
}

// small fixed-position menu shared by the project dropdown and the
// title context menu; closes on item click, outside mousedown, or Escape
export function FloatingMenu(props: {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) props.onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [props])

  const menuW = 220
  const left = Math.max(8, Math.min(props.x, window.innerWidth - menuW - 8))
  return (
    <div
      ref={ref}
      className="sf-floating-menu"
      role="menu"
      style={{ top: props.y, left, width: menuW }}
    >
      {props.items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={item.danger ? 'sf-menu-danger' : undefined}
          onClick={() => {
            item.onSelect()
            props.onClose()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
