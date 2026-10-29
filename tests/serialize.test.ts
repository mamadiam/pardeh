import { describe, expect, it } from 'vitest'
import { emptyDoc, type ScreenplayDoc } from '../src/core/types'
import { loadFromJson, saveToJson } from '../src/core/serialize'

describe('emptyDoc', () => {
  it('defaults to ltr with one empty action block', () => {
    const doc = emptyDoc()
    expect(doc.direction).toBe('ltr')
    expect(doc.schemaVersion).toBe(1)
    expect(doc.blocks).toEqual([{ type: 'action', text: '' }])
    expect(doc.meta.title).toBe('')
    expect(doc.meta.author).toBe('')
    expect(doc.meta.created).toBeTruthy()
  })
})

describe('saveToJson / loadFromJson', () => {
  it('round-trips a document without loss', () => {
    const doc: ScreenplayDoc = {
      ...emptyDoc(),
      meta: { ...emptyDoc().meta, title: 'سلام', author: 'Ada' },
      direction: 'rtl',
      blocks: [
        { type: 'scene', text: 'داخلی. خانه - شب' },
        { type: 'dialogue', text: '"Hello" مان' },
      ],
    }
    const result = loadFromJson(saveToJson(doc))
    expect(result.error).toBeUndefined()
    expect(result.warnings).toEqual([])
    expect(result.doc).toEqual(doc)
  })

  it('maps unknown block types to action with a warning', () => {
    const doc = emptyDoc()
    doc.blocks.push({ type: 'whatever' as never, text: 'x' })
    const result = loadFromJson(saveToJson(doc))
    expect(result.warnings.some((w) => w.includes('unknown element type'))).toBe(true)
    expect(result.doc!.blocks.at(-1)).toEqual({ type: 'action', text: 'x' })
  })

  it('returns an error for malformed JSON, never throws', () => {
    const result = loadFromJson('{not json')
    expect(result.doc).toBeNull()
    expect(result.error).toBe('invalid file')
  })

  it('returns an error for non-object JSON', () => {
    expect(loadFromJson('[1,2,3]').error).toBe('invalid file')
  })
})
