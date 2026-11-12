import { afterEach, describe, expect, it } from 'vitest'
import {
  buildChatMessages,
  estimatePages,
  interpretReply,
  loadHistory,
  parseCommand,
  saveHistory,
  sceneRangeAt,
  scenesOf,
  scriptText,
  type ChatContext,
} from '../src/ai/chat'
import { jumpToBlock, replaceBlocks } from '../src/ai/assist'
import { createEditor, tiptapToDoc } from '../src/editor/schema'
import { emptyDoc, type ScreenplayBlock } from '../src/core/types'

const script: ScreenplayBlock[] = [
  { type: 'action', text: 'Rain.' },
  { type: 'scene', text: 'INT. KITCHEN - DAY' },
  { type: 'action', text: 'Mina burns the toast.' },
  { type: 'scene', text: 'EXT. ROOF - NIGHT' },
  { type: 'character', text: 'REZA' },
  { type: 'dialogue', text: 'You came.' },
]

const ctx: ChatContext = { title: 'Roofs', direction: 'ltr', blocks: script, cursorIndex: 4 }

afterEach(() => localStorage.clear())

describe('parseCommand', () => {
  it('reads known commands and their argument', () => {
    expect(parseCommand('/scene they meet on the roof')).toEqual({ command: 'scene', arg: 'they meet on the roof' })
    expect(parseCommand('/PunchUp')).toEqual({ command: 'punchup', arg: '' })
  })
  it('treats unknown commands and plain text as chat', () => {
    expect(parseCommand('/dance now').command).toBeNull()
    expect(parseCommand('is this slow?')).toEqual({ command: null, arg: 'is this slow?' })
  })
})

describe('script helpers', () => {
  it('lists scenes, with an untitled opening for text before the first heading', () => {
    expect(scenesOf(script)).toEqual([
      { index: 0, heading: '', lines: 1 },
      { index: 1, heading: 'INT. KITCHEN - DAY', lines: 1 },
      { index: 3, heading: 'EXT. ROOF - NIGHT', lines: 2 },
    ])
  })

  it('finds the scene around a block', () => {
    expect(sceneRangeAt(script, 4)).toEqual({ start: 3, end: 5 })
    expect(sceneRangeAt(script, 2)).toEqual({ start: 1, end: 2 })
  })

  it('estimates pages and minutes at about 55 lines a page', () => {
    const long = Array.from({ length: 55 }, () => ({ type: 'action' as const, text: 'x'.repeat(61) }))
    const est = estimatePages(long)
    expect(est.pages).toBeGreaterThanOrEqual(1.9)
    expect(est.pages).toBeLessThanOrEqual(2.1)
    expect(est.minutes).toBe(2)
    expect(estimatePages(script).scenes).toBe(2)
  })

  it('keeps every heading and the latest text when the script is long', () => {
    const big: ScreenplayBlock[] = []
    for (let i = 0; i < 400; i++) {
      big.push({ type: 'scene', text: `SCENE ${i}` }, { type: 'action', text: 'y'.repeat(80) })
    }
    const text = scriptText(big)
    expect(text.length).toBeLessThan(20_000)
    expect(text).toContain('SCENE: SCENE 0')
    expect(text).toContain('SCENE: SCENE 399')
  })
})

describe('buildChatMessages', () => {
  it('sends the script, recent history, and a task per command', () => {
    const msgs = buildChatMessages('scene', 'Mina jumps', ctx, [{ role: 'user', text: 'hello' }, { role: 'assistant', text: 'hi' }])
    expect(msgs[0].role).toBe('system')
    expect(msgs[1].content).toContain('CHARACTER: REZA')
    expect(msgs[1].content).toContain('The cursor is in the scene: EXT. ROOF - NIGHT')
    expect(msgs.at(-1)?.content).toMatch(/pitch: Mina jumps/)
    expect(msgs.at(-1)?.content).toMatch(/\{"blocks"/)
    expect(msgs.some((m) => m.content === 'hello')).toBe(true)
  })

  it('punchup sends only the current scene to revise', () => {
    const task = buildChatMessages('punchup', '', ctx, []).at(-1)?.content ?? ''
    expect(task).toContain('DIALOGUE: You came.')
    expect(task).not.toContain('Mina burns the toast.')
  })

  it('asks for Persian in right-to-left scripts', () => {
    expect(buildChatMessages(null, 'hi', { ...ctx, direction: 'rtl' }, [])[0].content).toMatch(/Persian \(Farsi\)/)
  })
})

describe('interpretReply', () => {
  it('turns scene and format replies into insertable lines, punchup into a scene replacement', () => {
    const raw = '{"blocks":[{"type":"scene","text":"INT. HALL - DAY"}]}'
    expect(interpretReply('scene', raw)).toMatchObject({ action: 'insert', blocks: [{ type: 'scene', text: 'INT. HALL - DAY' }] })
    expect(interpretReply('punchup', raw).action).toBe('replace-scene')
  })
  it('reads every outline beat', () => {
    const beats = Array.from({ length: 12 }, (_, i) => `beat ${i + 1}`)
    expect(interpretReply('outline', JSON.stringify({ ideas: beats })).beats).toHaveLength(12)
  })
  it('keeps prose answers as text', () => {
    expect(interpretReply('coverage', '  Verdict: Consider  ').text).toBe('Verdict: Consider')
  })
})

describe('history', () => {
  it('is kept per project', () => {
    saveHistory('p1', [{ role: 'user', text: 'a' }])
    expect(loadHistory('p1')).toEqual([{ role: 'user', text: 'a' }])
    expect(loadHistory('p2')).toEqual([])
  })
})

describe('editor operations', () => {
  it('replaces a scene as one undo step and can jump to a block', () => {
    const editor = createEditor({ ...emptyDoc(), blocks: script })
    replaceBlocks(editor, 3, 5, [{ type: 'scene', text: 'EXT. ROOF - DAWN' }, { type: 'action', text: 'Empty.' }])
    const texts = () => tiptapToDoc(editor.getJSON().content ?? [], emptyDoc().meta, 'ltr').blocks.map((b) => b.text)
    expect(texts().slice(3)).toEqual(['EXT. ROOF - DAWN', 'Empty.'])
    editor.commands.undo()
    expect(texts().slice(3)).toEqual(['EXT. ROOF - NIGHT', 'REZA', 'You came.'])
    jumpToBlock(editor, 2)
    expect(editor.state.selection.$head.index(0)).toBe(2)
  })
})
