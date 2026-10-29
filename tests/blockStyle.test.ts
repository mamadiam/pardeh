import { describe, expect, it } from 'vitest'
import { blockStyle } from '../src/editor/blockStyle'
import {
  createEditor,
  docToTiptapContent,
  tiptapToDoc,
} from '../src/editor/schema'
import { emptyDoc, type ScreenplayDoc } from '../src/core/types'

describe('blockStyle', () => {
  it('indents character with logical margin, mirrors for rtl', () => {
    const style = blockStyle('character', 'rtl')
    expect(style.marginInlineStart).toBe('55.9mm')
    expect(Object.keys(style)).not.toContain('marginLeft')
    expect(Object.keys(style)).not.toContain('marginRight')
  })

  it('uses the filmnevis indent table', () => {
    expect(blockStyle('parenthetical', 'ltr').marginInlineStart).toBe('40.6mm')
    expect(blockStyle('dialogue', 'ltr').marginInlineStart).toBe('25.4mm')
    expect(blockStyle('transition', 'ltr').marginInlineStart).toBe('55.9mm')
  })

  it('leaves scene and action unindented', () => {
    expect(blockStyle('scene', 'ltr').marginInlineStart).toBeUndefined()
    expect(blockStyle('action', 'rtl').marginInlineStart).toBeUndefined()
  })
})

describe('schema round trip', () => {
  it('maps emptyDoc to a single untyped-text action block node', () => {
    const content = docToTiptapContent(emptyDoc())
    expect(content).toEqual([
      { type: 'block', attrs: { elementType: 'action' } },
    ])
  })

  it('round trips a full document', () => {
    const doc: ScreenplayDoc = {
      ...emptyDoc(),
      direction: 'rtl',
      blocks: [
        { type: 'scene', text: 'داخلی. خانه - شب' },
        { type: 'character', text: 'SARA' },
        { type: 'parenthetical', text: 'کمی خسته' },
        { type: 'dialogue', text: 'Hello' },
        { type: 'transition', text: 'CUT TO:' },
      ],
    }
    const back = tiptapToDoc(
      docToTiptapContent(doc),
      doc.meta,
      doc.direction,
    )
    expect(back).toEqual(doc)
  })

  it('creates a TipTap editor whose JSON matches the doc', () => {
    const doc = emptyDoc()
    const editor = createEditor(doc)
    expect(editor.getJSON().content).toEqual(docToTiptapContent(doc))
    editor.destroy()
  })
})
