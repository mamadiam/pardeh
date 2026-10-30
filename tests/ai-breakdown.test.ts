import { describe, expect, it } from 'vitest'
import type { ScreenplayDoc } from '../src/core/types'

const doc: ScreenplayDoc = {
  schemaVersion: 1,
  meta: { title: 'Test', author: '', created: '', modified: '' },
  direction: 'ltr',
  blocks: [
    { type: 'scene', text: 'INT. HOUSE - NIGHT' },
    { type: 'action', text: 'The lights flicker.' },
    { type: 'character', text: 'SARA' },
    { type: 'dialogue', text: 'Who is there?' },
  ],
}

describe('buildBreakdownPrompt', () => {
  it('sends every block with its element label', async () => {
    const { buildBreakdownPrompt } = await import('../src/ai/breakdown')
    const prompt = buildBreakdownPrompt(doc)
    expect(prompt).toContain('INT. HOUSE - NIGHT')
    expect(prompt).toContain('SARA')
    expect(prompt).toContain('Who is there?')
    expect(prompt).toMatch(/Scene Heading:\s*INT/)
    expect(prompt).toMatch(/Dialogue:/)
  })
})

describe('parseBreakdown', () => {
  it('parses a clean JSON object', async () => {
    const { parseBreakdown } = await import('../src/ai/breakdown')
    const raw = JSON.stringify({
      logline: 'A night visit goes wrong.',
      characters: [{ name: 'SARA', description: 'the visitor' }],
      locations: ['House'],
      scenes: [{ title: 'INT. HOUSE - NIGHT', summary: 'Lights flicker; a stranger calls out.' }],
    })
    const b = parseBreakdown(raw)
    expect(b.logline).toContain('night visit')
    expect(b.characters[0].name).toBe('SARA')
    expect(b.scenes[0].summary).toContain('flicker')
  })

  it('strips markdown fences before parsing', async () => {
    const { parseBreakdown } = await import('../src/ai/breakdown')
    const raw = '```json\n{"logline":"x","characters":[],"locations":[],"scenes":[]}\n```'
    expect(parseBreakdown(raw).logline).toBe('x')
  })

  it('throws AiError bad-json on garbage', async () => {
    const { parseBreakdown } = await import('../src/ai/breakdown')
    const { AiError } = await import('../src/ai/client')
    let threw = 'no'
    try {
      parseBreakdown('I cannot analyse this screenplay')
    } catch (e) {
      threw = e instanceof AiError && e.code === 'bad-json' ? 'yes' : 'wrong'
    }
    expect(threw).toBe('yes')
  })
})
