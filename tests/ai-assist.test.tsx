import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/core'
import {
  buildAssistPrompt,
  contextAt,
  insertBlocksAtCursor,
  parseBlocks,
  parseIdeas,
} from '../src/ai/assist'
import { saveAiConfig } from '../src/ai/config'
import { createEditor, tiptapToDoc } from '../src/editor/schema'
import App from '../src/App'
import { emptyDoc, type ScreenplayBlock, type ScreenplayDoc } from '../src/core/types'

const script: ScreenplayBlock[] = [
  { type: 'scene', text: 'INT. KITCHEN - DAY' },
  { type: 'action', text: 'Mina burns the toast.' },
  { type: 'scene', text: 'EXT. ROOF - NIGHT' },
  { type: 'action', text: 'Reza waits by the ledge.' },
  { type: 'character', text: 'REZA' },
  { type: 'dialogue', text: 'You came.' },
  { type: 'scene', text: 'INT. CAR - NIGHT' },
  { type: 'action', text: 'Silence.' },
]

function docOf(blocks: ScreenplayBlock[]): ScreenplayDoc {
  return { ...emptyDoc(), blocks }
}

function reply(content: string) {
  return vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }))
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('contextAt', () => {
  it('takes the current scene up to the cursor, what follows, and earlier headings', () => {
    const ctx = contextAt(script, 4, 'Roofs', 'ltr')
    expect(ctx.before.map((b) => b.text)).toEqual(['EXT. ROOF - NIGHT', 'Reza waits by the ledge.', 'REZA'])
    expect(ctx.after[0].text).toBe('You came.')
    expect(ctx.earlierScenes).toEqual(['INT. KITCHEN - DAY'])
  })
})

describe('buildAssistPrompt', () => {
  const ctx = contextAt(script, 4, 'Roofs', 'ltr')

  it('asks for three ideas as JSON for next and scene', () => {
    expect(buildAssistPrompt('next', ctx).prompt).toMatch(/\{"ideas"/)
    expect(buildAssistPrompt('scene', ctx).prompt).toMatch(/stronger/)
  })

  it('asks for typed blocks that lead into what follows when filling', () => {
    const { prompt } = buildAssistPrompt('fill', ctx, 'he confesses')
    expect(prompt).toMatch(/\{"blocks"/)
    expect(prompt).toMatch(/lead naturally into what comes right after/)
    expect(prompt).toContain("The writer's note: he confesses")
    expect(prompt).toContain('CHARACTER: REZA')
  })

  it('puts the question in for ask and tells RTL scripts to stay in their language', () => {
    const rtl = contextAt(script, 4, '', 'rtl')
    const { system, prompt } = buildAssistPrompt('ask', rtl, 'Is this too slow?')
    expect(prompt).toContain('Question: Is this too slow?')
    expect(system).toMatch(/Write every piece of text in Persian \(Farsi\)/)
    expect(buildAssistPrompt('next', ctx).system).toMatch(/same language as the script/)
  })
})

describe('parsing', () => {
  it('reads ideas from JSON, fenced JSON, or a plain list', () => {
    expect(parseIdeas('{"ideas":["a","b","c"]}')).toEqual(['a', 'b', 'c'])
    expect(parseIdeas('```json\n{"ideas":["x"]}\n```')).toEqual(['x'])
    expect(parseIdeas('1. first\n2. second')).toEqual(['first', 'second'])
  })

  it('keeps valid blocks, maps unknown types to action, and rejects empty output', () => {
    expect(parseBlocks('{"blocks":[{"type":"character","text":"MINA"},{"type":"weird","text":"x"},{"type":"action","text":" "}]}'))
      .toEqual([{ type: 'character', text: 'MINA' }, { type: 'action', text: 'x' }])
    expect(() => parseBlocks('{"blocks":[]}')).toThrow()
  })
})

describe('insertBlocksAtCursor', () => {
  let editor: Editor
  beforeEach(() => {
    editor = createEditor(docOf(script.slice(0, 2)))
  })

  it('inserts after the cursor block as one undo step', () => {
    editor.commands.setTextSelection(3) // inside the scene heading
    insertBlocksAtCursor(editor, [{ type: 'action', text: 'New line.' }, { type: 'character', text: 'MINA' }])
    const texts = () => tiptapToDoc(editor.getJSON().content ?? [], emptyDoc().meta, 'ltr').blocks.map((b) => b.text)
    expect(texts()).toEqual(['INT. KITCHEN - DAY', 'New line.', 'MINA', 'Mina burns the toast.'])
    editor.commands.undo()
    expect(texts()).toEqual(['INT. KITCHEN - DAY', 'Mina burns the toast.'])
  })

  it('replaces an empty block instead of leaving a blank line', () => {
    const ed = createEditor(docOf([{ type: 'action', text: '' }]))
    insertBlocksAtCursor(ed, [{ type: 'scene', text: 'INT. HALL - DAY' }])
    expect(tiptapToDoc(ed.getJSON().content ?? [], emptyDoc().meta, 'ltr').blocks)
      .toEqual([{ type: 'scene', text: 'INT. HALL - DAY' }])
  })
})

describe('Assistant panel', () => {
  it('points to settings when no model is configured', () => {
    render(<App doc={docOf(script)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Assistant' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    expect(screen.getByRole('dialog', { name: 'AI settings' })).toBeTruthy()
  })

  it('suggests ideas, writes one out, and inserts it into the script', async () => {
    saveAiConfig({ provider: 'ollama', endpoint: 'http://localhost:11434/v1', model: 'llama3.1' })
    let editor: Editor | null = null
    render(<App doc={docOf(script)} onEditorReady={(e) => { editor = e }} />)
    await waitFor(() => expect(editor).not.toBeNull())

    vi.stubGlobal('fetch', reply('{"ideas":["Reza admits he sold the house.","Mina never shows up."]}'))
    fireEvent.click(screen.getByRole('button', { name: 'Assistant' }))
    fireEvent.click(screen.getByRole('button', { name: 'What happens next?' }))
    expect(await screen.findByText('Reza admits he sold the house.')).toBeTruthy()

    vi.stubGlobal('fetch', reply('{"blocks":[{"type":"character","text":"MINA"},{"type":"dialogue","text":"You sold it."}]}'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Write this' })[0])
    expect(await screen.findByText('You sold it.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Insert at cursor' }))
    expect(screen.queryByRole('dialog', { name: 'writing assistant' })).toBeNull()
    const texts = tiptapToDoc(editor!.getJSON().content ?? [], emptyDoc().meta, 'ltr').blocks.map((b) => b.text)
    expect(texts).toContain('You sold it.')
  })

  it('shows an error with Retry when the model fails', async () => {
    saveAiConfig({ provider: 'ollama', endpoint: 'http://localhost:11434/v1', model: 'llama3.1' })
    render(<App doc={docOf(script)} />)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
    fireEvent.click(screen.getByRole('button', { name: 'Assistant' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'question or note' }), { target: { value: 'Is this slow?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText(/http-500/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})
