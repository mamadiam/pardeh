import { SCHEMA_VERSION, type ScreenplayBlock, type ScreenplayDoc, emptyDoc } from './types'

const VALID_TYPES = new Set<string>([
  'scene',
  'action',
  'character',
  'parenthetical',
  'dialogue',
  'transition',
])

export function saveToJson(doc: ScreenplayDoc): string {
  const updated: ScreenplayDoc = {
    ...doc,
    meta: { ...doc.meta, modified: new Date().toISOString() },
  }
  return JSON.stringify(updated, null, 2)
}

type LoadResult = {
  doc: ScreenplayDoc | null
  error?: string
  warnings: string[]
}

export function loadFromJson(json: string): LoadResult {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return { doc: null, error: 'invalid file', warnings: [] }
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { doc: null, error: 'invalid file', warnings: [] }
  }
  const d = data as Record<string, unknown>
  const doc = emptyDoc()
  if (typeof d.schemaVersion === 'number') doc.schemaVersion = d.schemaVersion
  if (typeof d.direction === 'string' && (d.direction === 'ltr' || d.direction === 'rtl')) {
    doc.direction = d.direction
  }
  const meta = d.meta
  if (typeof meta === 'object' && meta !== null) {
    const m = meta as Record<string, unknown>
    if (typeof m.title === 'string') doc.meta.title = m.title
    if (typeof m.author === 'string') doc.meta.author = m.author
    if (typeof m.created === 'string') doc.meta.created = m.created
    if (typeof m.modified === 'string') doc.meta.modified = m.modified
  }
  const warnings: string[] = []
  if (Array.isArray(d.blocks)) {
    const blocks: ScreenplayBlock[] = []
    for (const raw of d.blocks) {
      if (typeof raw !== 'object' || raw === null) continue
      const b = raw as Record<string, unknown>
      const text = typeof b.text === 'string' ? b.text : ''
      if (typeof b.type === 'string' && VALID_TYPES.has(b.type)) {
        blocks.push({ type: b.type as ScreenplayBlock['type'], text })
      } else {
        warnings.push(`unknown element type "${String(b.type)}" treated as action`)
        blocks.push({ type: 'action', text })
      }
    }
    doc.blocks = blocks
  }
  return { doc, warnings }
}
