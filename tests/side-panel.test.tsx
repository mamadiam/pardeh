import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/core'
import App from '../src/App'
import { saveAiConfig } from '../src/ai/config'
import { tiptapToDoc } from '../src/editor/schema'
import { emptyDoc, type ScreenplayBlock } from '../src/core/types'
import { searchGlossary } from '../src/glossary'

const script: ScreenplayBlock[] = [
  { type: 'scene', text: 'INT. KITCHEN - DAY' },
  { type: 'action', text: 'Mina burns the toast.' },
  { type: 'scene', text: 'EXT. ROOF - NIGHT' },
  { type: 'character', text: 'REZA' },
  { type: 'dialogue', text: 'You came.' },
]

function reply(content: string) {
  return vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }))
}

let editor: Editor | null = null
const texts = () => tiptapToDoc(editor!.getJSON().content ?? [], emptyDoc().meta, 'ltr').blocks.map((b) => b.text)

async function openApp() {
  editor = null
  render(<App doc={{ ...emptyDoc(), blocks: script }} onEditorReady={(e) => { editor = e }} />)
  await waitFor(() => expect(editor).not.toBeNull())
  fireEvent.click(screen.getByRole('button', { name: 'Chat' }))
  return screen.getByRole('complementary', { name: 'side panel' })
}

function send(text: string) {
  const box = screen.getByRole('textbox', { name: 'chat message' })
  fireEvent.change(box, { target: { value: text } })
  fireEvent.keyDown(box, { key: 'Enter' })
}

beforeEach(() => {
  localStorage.clear()
  saveAiConfig({ provider: 'ollama', endpoint: 'http://localhost:11434/v1', model: 'llama3.1' })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('side panel', () => {
  it('opens and closes from the toolbar and remembers the choice', async () => {
    const panel = await openApp()
    expect(panel).toBeTruthy()
    expect(localStorage.getItem('sf-panel')).toBe('open')
    fireEvent.click(within(panel).getByRole('button', { name: 'Close panel' }))
    expect(screen.queryByRole('complementary', { name: 'side panel' })).toBeNull()
    expect(localStorage.getItem('sf-panel')).toBe('closed')
  })

  it('is hidden in focus mode', async () => {
    await openApp()
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }))
    expect(screen.queryByRole('complementary', { name: 'side panel' })).toBeNull()
  })
})

describe('chat', () => {
  it('answers /pagecount and /help without calling a model', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    await openApp()
    send('/pagecount')
    expect(await screen.findByText(/About .* pages, roughly .* minutes on screen/)).toBeTruthy()
    send('/help')
    expect(await screen.findByText('Commands')).toBeTruthy()
    expect(f).not.toHaveBeenCalled()
  })

  it('suggests commands while typing a slash', async () => {
    await openApp()
    fireEvent.change(screen.getByRole('textbox', { name: 'chat message' }), { target: { value: '/sc' } })
    const list = screen.getByRole('listbox', { name: 'Commands' })
    fireEvent.click(within(list).getByRole('option', { name: /\/scene/ }))
    expect((screen.getByRole('textbox', { name: 'chat message' }) as HTMLTextAreaElement).value).toBe('/scene ')
  })

  it('writes a scene with /scene and inserts it at the cursor', async () => {
    vi.stubGlobal('fetch', reply('{"blocks":[{"type":"scene","text":"INT. CAR - NIGHT"},{"type":"action","text":"Silence."}]}'))
    await openApp()
    send('/scene they drive home in silence')
    expect(await screen.findByText('INT. CAR - NIGHT')).toBeTruthy()
    editor!.commands.setTextSelection(editor!.state.doc.content.size - 1)
    fireEvent.click(screen.getByRole('button', { name: 'Insert at cursor' }))
    expect(texts().slice(-2)).toEqual(['INT. CAR - NIGHT', 'Silence.'])
    expect(screen.getByText('Inserted into the script.')).toBeTruthy()
  })

  it('punches up the scene at the cursor and replaces it in one undo step', async () => {
    vi.stubGlobal('fetch', reply('{"blocks":[{"type":"scene","text":"EXT. ROOF - NIGHT"},{"type":"character","text":"REZA"},{"type":"dialogue","text":"Took you long enough."}]}'))
    await openApp()
    editor!.commands.setTextSelection(editor!.state.doc.content.size - 1) // in the roof scene
    send('/punchup')
    fireEvent.click(await screen.findByRole('button', { name: 'Replace this scene' }))
    expect(texts()).toEqual(['INT. KITCHEN - DAY', 'Mina burns the toast.', 'EXT. ROOF - NIGHT', 'REZA', 'Took you long enough.'])
    editor!.commands.undo()
    expect(texts().at(-1)).toBe('You came.')
  })

  it('turns an outline beat into a scene', async () => {
    vi.stubGlobal('fetch', reply('{"ideas":["Mina finds the deed.","Reza confesses."]}'))
    await openApp()
    send('/outline')
    expect(await screen.findByText('Mina finds the deed.')).toBeTruthy()
    const f = reply('{"blocks":[{"type":"scene","text":"INT. STUDY - NIGHT"}]}')
    vi.stubGlobal('fetch', f)
    fireEvent.click(screen.getAllByRole('button', { name: 'Write this scene' })[0])
    expect(await screen.findByText('INT. STUDY - NIGHT')).toBeTruthy()
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.messages.at(-1).content).toContain('Mina finds the deed.')
  })

  it('keeps the conversation per project and shows errors with Retry', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
    await openApp()
    send('Is the roof scene too short?')
    expect(await screen.findByText(/http-503/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(localStorage.getItem('sf-chat:current')).toContain('Is the roof scene too short?')
  })
})

describe('scenes timeline', () => {
  it('lists scenes with an estimate and jumps to one', async () => {
    const panel = await openApp()
    fireEvent.click(within(panel).getByRole('tab', { name: 'Scenes' }))
    expect(within(panel).getByText(/2 scenes · about/)).toBeTruthy()
    fireEvent.click(within(panel).getByRole('button', { name: 'Go to scene 2' }))
    expect(editor!.state.selection.$head.index(0)).toBe(2)
  })
})

describe('glossary', () => {
  it('opens from the panel and searches in both languages', async () => {
    const panel = await openApp()
    fireEvent.click(within(panel).getByRole('button', { name: 'Glossary' }))
    const dialog = screen.getByRole('dialog', { name: 'Screenwriting glossary' })
    fireEvent.change(within(dialog).getByRole('searchbox', { name: 'Search terms' }), { target: { value: 'logline' } })
    expect(within(dialog).getByText('Logline')).toBeTruthy()
    expect(searchGlossary('زیرمتن', 'fa').map((e) => e.term.en)).toContain('Subtext')
    expect(searchGlossary('O.S.', 'en').map((e) => e.term.en)).toContain('Off-screen (O.S.)')
  })
})
