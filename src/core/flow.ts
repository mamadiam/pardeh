// Port of filmnevis archive/qt-version/filmnevis/constants.py ELEMENTS +
// editor.py _handle_enter (lines 493-510) to pure functions.
import type { ElementType } from './types'

export const ELEMENT_ORDER: readonly ElementType[] = [
  'scene',
  'action',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
]

export const ELEMENT_LABEL: Record<ElementType, string> = {
  scene: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
}

const FLOW: Record<ElementType, ElementType> = {
  scene: 'action',
  action: 'scene',
  character: 'dialogue',
  parenthetical: 'dialogue',
  dialogue: 'character',
  transition: 'scene',
}

export function nextOnEnter(type: ElementType, blockText: string): ElementType {
  if (type === 'parenthetical') return 'dialogue'
  if (type === 'transition') return 'scene'
  if (blockText === '') return type
  return FLOW[type]
}

export function cycleElement(type: ElementType, step: 1 | -1): ElementType {
  const idx = ELEMENT_ORDER.indexOf(type)
  // unknown types cycle to the nearest boundary sensibly; can't happen for valid ElementType
  const len = ELEMENT_ORDER.length
  return ELEMENT_ORDER[(idx + step + len) % len]
}

export function hotkeyElement(n: number): ElementType | null {
  if (n < 1 || n > ELEMENT_ORDER.length) return null
  return ELEMENT_ORDER[n - 1]
}
