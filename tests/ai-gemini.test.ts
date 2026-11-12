import { afterEach, describe, expect, it, vi } from 'vitest'
import { chat, listModels } from '../src/ai/client'
import type { AiConfig } from '../src/ai/types'

const gemini: AiConfig = {
  provider: 'gemini',
  endpoint: 'https://generativelanguage.googleapis.com/v1beta',
  model: 'gemini-2.5-flash',
  apiKey: 'AIza-test',
}

afterEach(() => vi.unstubAllGlobals())

describe('Gemini provider', () => {
  it('calls generateContent with the key in a header and maps roles', async () => {
    const f = vi.fn(async () =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'سلام ' }, { text: 'دنیا' }] } }] }), { status: 200 }),
    )
    vi.stubGlobal('fetch', f)
    const out = await chat(gemini, [
      { role: 'system', content: 'Be brief.' },
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
      { role: 'user', content: 'Again' },
    ])
    expect(out).toBe('سلام دنیا')
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent')
    expect(url).not.toContain('AIza')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('AIza-test')
    const body = JSON.parse(init.body as string)
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'Be brief.' }] })
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user'])
  })

  it('lists only models that can generate content, without the models/ prefix', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      models: [
        { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
      ],
    }), { status: 200 })))
    expect(await listModels(gemini)).toEqual(['gemini-2.5-pro'])
  })

  it('needs a key', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(chat({ ...gemini, apiKey: undefined }, [{ role: 'user', content: 'x' }])).rejects.toMatchObject({ code: 'no-config' })
  })
})
