export const SCHEMA_VERSION = 1

export type ElementType =
  | 'scene'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition'

export type Direction = 'ltr' | 'rtl'

export interface ScreenplayMeta {
  title: string
  author: string
  created: string
  modified: string
}

export interface ScreenplayBlock {
  type: ElementType
  text: string
}

export interface ScreenplayDoc {
  schemaVersion: number
  meta: ScreenplayMeta
  direction: Direction
  blocks: ScreenplayBlock[]
}

function now(): string {
  return new Date().toISOString()
}

export function emptyDoc(): ScreenplayDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { title: '', author: '', created: now(), modified: now() },
    direction: 'ltr',
    blocks: [{ type: 'action', text: '' }],
  }
}
