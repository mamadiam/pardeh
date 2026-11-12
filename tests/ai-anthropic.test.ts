import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiError, chat, listModels } from '../src/ai/client'
import { PROVIDERS, type AiConfig } from '../src/ai/types'

const claude: AiConfig = {
  provider: 'anthropic',
  endpoint: 'https://api.anthropic.com/v1',
  model: 'claude-sonnet-5-5',
  apiKey: 'sk-ant-test',
}

afterEach(() => vi.unstubAllGlobals())

describe('Claude provider', () => {
  it('is listed with the Anthropic endpoint and needs a key', () => {
    const info = PROVIDERS.find((p) => p.id === 'anthropic')
    expect(info?.baseURL).toBe('https://api.anthropic.com/v1')
    expect(info?.needsKey).toBe(true)
  })

  it('posts to /messages with the key, version and browser-access headers', async () => {
    const f = vi.fn(async () =>
      new Response(JSON.stringify({ content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'there' }] }), { status: 200 }),
    )
    vi.stubGlobal('fetch', f)
    const out = await chat(claude, [
      { role: 'system', content: 'You are a screenwriter.' },
      { role: 'user', content: 'Write a line.' },
    ])
    expect(out).toBe('Hello there')
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    const headers = init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-ant-test')
    expect(headers['anthropic-version']).toBe('2023-06-01')
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    expect(headers.Authorization).toBeUndefined()
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('claude-sonnet-5-5')
    expect(body.system).toBe('You are a screenwriter.')
    expect(body.messages).toEqual([{ role: 'user', content: 'Write a line.' }])
    expect(body.max_tokens).toBeGreaterThan(0)
  })

  it('refuses to call without a key', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(chat({ ...claude, apiKey: undefined }, [{ role: 'user', content: 'x' }])).rejects.toMatchObject({ code: 'no-config' })
  })

  it('surfaces HTTP errors with their status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    const err = await chat(claude, [{ role: 'user', content: 'x' }]).catch((e) => e)
    expect(err).toBeInstanceOf(AiError)
    expect(err.code).toBe('http-401')
  })

  it('lists models from /models with the same headers', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: 'claude-opus-5-5' }, { id: 'claude-haiku-5-5' }] }), { status: 200 }))
    vi.stubGlobal('fetch', f)
    expect(await listModels(claude)).toEqual(['claude-opus-5-5', 'claude-haiku-5-5'])
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/models?limit=100')
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('sk-ant-test')
  })
})
