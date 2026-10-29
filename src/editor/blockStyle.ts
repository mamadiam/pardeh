import type { CSSProperties } from 'react'
import type { Direction, ElementType } from '../core/types'

// Indent table from filmnevis archive/qt-version/filmnevis/constants.py,
// expressed as logical CSS so directionality mirrors natively.
const INDENT_MM: Record<ElementType, number> = {
  scene: 0,
  action: 0,
  character: 55.9,
  parenthetical: 40.6,
  dialogue: 25.4,
  transition: 55.9,
}

export function blockStyle(type: ElementType, _direction: Direction): CSSProperties {
  const mm = INDENT_MM[type]
  return mm > 0 ? { marginInlineStart: `${mm}mm` } : {}
}
