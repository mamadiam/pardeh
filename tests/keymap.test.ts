import { describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import type { ScreenplayDoc } from '../src/core/types'
import { createEditor } from '../src/editor/schema'

function docOf(blocks: { type: ScreenplayDoc['blocks'][number]['type']; text: string }[]): ScreenplayDoc {
  return {
    schemaVersion: 1,
    meta: { title: '', author: '', created: '', modified: '' },
    direction: 'ltr',
    blocks,
  }
}

function typesOf(editor: Editor): string[] {
  return (editor.getJSON().content ?? [])
    .filter((n) => n.type === 'block')
    .map((n) => (n.attrs as { elementType?: string }).elementType)
}

function cursorToEndOfBlock(editor: Editor, index: number): void {
  const end = endOfBlockText(editor, index)
  editor.commands.setTextSelection({ from: end, to: end })
}

/** absolute text position at end of block `index` in a flat block-only doc */
function endOfBlockText(editor: Editor, index: number): number {
  const doc = editor.state.doc
  const node = doc.child(index)
  // start of node content = position after opening token
  let start = 0
  for (let i = 0; i < index; i++) start += doc.child(i).nodeSize
  return start + 1 + node.textContent.length
}

describe('smartEnter', () => {
  it('scene block → new trailing action block', () => {
    const editor = createEditor(docOf([{ type: 'scene', text: 'INT. HOUSE - NIGHT' }]))
    const end = endOfBlockText(editor, 0)
    editor.commands.setTextSelection({ from: end, to: end })
    expect(editor.commands.smartEnter()).toBe(true)
    expect(typesOf(editor)).toEqual(['scene', 'action'])
    editor.destroy()
  })

  it('chains per filmnevis flow: action→scene→action', () => {
    const editor = createEditor(docOf([{ type: 'action', text: 'The door creaks.' }]))
    let end = endOfBlockText(editor, 0)
    editor.commands.setTextSelection({ from: end, to: end })
    editor.commands.smartEnter()
    end = endOfBlockText(editor, 1)
    editor.commands.setTextSelection({ from: end, to: end })
    editor.commands.smartEnter()
    expect(typesOf(editor)).toEqual(['action', 'scene', 'scene'])
    editor.destroy()
  })

  it('keeps the same element on an empty block (filmnevis:507)', () => {
    const editor = createEditor(docOf([{ type: 'dialogue', text: '' }]))
    const mid = endOfBlockText(editor, 0) - 1 // inside the empty block
    editor.commands.setTextSelection({ from: mid, to: mid })
    editor.commands.smartEnter()
    expect(typesOf(editor)).toEqual(['dialogue', 'dialogue'])
    editor.destroy()
  })
})

describe('cycleElement', () => {
  it('cycles selection block backwards: dialogue → parenthetical (filmnevis ELEMENT_ORDER)', () => {
    const editor = createEditor(
      docOf([
        { type: 'action', text: 'Sara enters.' },
        { type: 'dialogue', text: 'Hello' },
      ]),
    )
    const end = endOfBlockText(editor, 1)
    editor.commands.setTextSelection({ from: end, to: end })
    expect(editor.commands.cycleElement(-1)).toBe(true)
    expect(typesOf(editor)).toEqual(['action', 'parenthetical'])
    editor.destroy()
  })
})

describe('setElementType (hotkey backing command)', () => {
  it('changes the current block type', () => {
    const editor = createEditor(docOf([{ type: 'scene', text: 'INT. HOME' }]))
    const end = endOfBlockText(editor, 0)
    editor.commands.setTextSelection({ from: end, to: end })
    expect(editor.commands.setElementType('character')).toBe(true)
    expect(typesOf(editor)).toEqual(['character'])
    editor.destroy()
  })
})

describe('parenthetical coordinates', () => {
  it('typing "(" into an empty block makes it parenthetical', async () => {
    const editor = createEditor(docOf([{ type: 'action', text: '' }]))
    const mid = endOfBlockText(editor, 0) - 1
    editor.commands.setTextSelection({ from: mid, to: mid })
    // drive the keymap the way a real keydown would (char swallowed by handler)
    const handled = editor.view.someProp('handleKeyDown', (f: unknown) =>
      (f as (view: unknown, event: KeyboardEvent) => boolean)(editor.view, new KeyboardEvent('keydown', { key: '(' })),
    )
    expect(handled).toBe(true)
    expect(typesOf(editor)).toEqual(['parenthetical'])
    expect(editor.state.doc.textContent).not.toContain('(')
    editor.destroy()
  })
})
