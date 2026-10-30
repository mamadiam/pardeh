import { describe, expect, it } from 'vitest'

describe('buildGeneratePrompt', () => {
  it('asks for the full package as JSON with the six element types', async () => {
    const { buildGeneratePrompt } = await import('../src/ai/generate')
    const { prompt } = buildGeneratePrompt('a lighthouse keeper finds a mermaid')
    expect(prompt).toContain('a lighthouse keeper finds a mermaid')
    expect(prompt).toContain('"title"')
    expect(prompt).toContain('"logline"')
    expect(prompt).toContain('"genre"')
    expect(prompt).toContain('"characters"')
    expect(prompt).toContain('"scenes"')
    expect(prompt).toContain('scene')
    expect(prompt).toContain('dialogue')
  })

  it('passes the genre and the language note through', async () => {
    const { buildGeneratePrompt } = await import('../src/ai/generate')
    const { prompt } = buildGeneratePrompt('idea', { genre: 'noir' })
    expect(prompt).toContain('noir')
  })

  it('continuation includes the previous heading to continue from', async () => {
    const { buildGeneratePrompt } = await import('../src/ai/generate')
    const { prompt } = buildGeneratePrompt('idea', { continueFrom: 'INT. HOUSE - NIGHT' })
    expect(prompt).toContain('INT. HOUSE - NIGHT')
    expect(prompt).toContain('Continue the story')
  })
})

const RAW = JSON.stringify({
  title: 'The Tide',
  logline: 'A keeper discovers the sea keeps secrets.',
  genre: 'Mystery',
  characters: [{ name: 'AL', description: 'the keeper' }],
  scenes: [
    {
      heading: 'INT. LIGHTHOUSE - NIGHT',
      blocks: [
        { type: 'action', text: 'Wind hammers the glass.' },
        { type: 'character', text: 'AL' },
        { type: 'dialogue', text: 'Who sent you?' },
        { type: 'unknown-junk', text: 'should become action' },
      ],
    },
    { heading: 'EXT. SHORE - DAWN', blocks: [] },
  ],
})

describe('parseGenerated', () => {
  it('parses a clean package, tolerates fences and unknown block types', async () => {
    const { parseGenerated } = await import('../src/ai/generate')
    const gen = parseGenerated('```json\n' + RAW + '\n```')
    expect(gen.title).toBe('The Tide')
    expect(gen.genre).toBe('Mystery')
    expect(gen.characters).toEqual([{ name: 'AL', description: 'the keeper' }])
    expect(gen.scenes).toHaveLength(2)
    expect(gen.scenes[0].heading).toBe('INT. LIGHTHOUSE - NIGHT')
    expect(gen.scenes[0].blocks[3]).toEqual({ type: 'action', text: 'should become action' })
  })

  it('rejects garbage with bad-json', async () => {
    const { parseGenerated } = await import('../src/ai/generate')
    expect(() => parseGenerated('here is a story...')).toThrow()
  })

  it('rejects a package without scenes', async () => {
    const { parseGenerated } = await import('../src/ai/generate')
    expect(() => parseGenerated('{"title":"x"}')).toThrow()
  })
})

describe('docFromGenerated', () => {
  it('flattens scenes into blocks and sets the title', async () => {
    const { parseGenerated, docFromGenerated } = await import('../src/ai/generate')
    const gen = parseGenerated(RAW)
    const doc = docFromGenerated(gen)
    expect(doc.meta.title).toBe('The Tide')
    expect(doc.blocks[0]).toEqual({ type: 'scene', text: 'INT. LIGHTHOUSE - NIGHT' })
    expect(doc.blocks[1].type).toBe('action')
    expect(doc.blocks[2].type).toBe('character')
    expect(doc.blocks[3].type).toBe('dialogue')
    expect(doc.blocks[4]).toEqual({ type: 'action', text: 'should become action' })
    // scene 2's heading still lands even with no inner blocks
    expect(doc.blocks[5]).toEqual({ type: 'scene', text: 'EXT. SHORE - DAWN' })
  })
})
