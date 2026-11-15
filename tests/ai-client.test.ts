import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiError, chat, listModels } from '../src/ai/client'
import type { AiConfig } from '../src/ai/types'

const ollama: AiConfig = { provider: 'ollama', endpoint: 'http://localhost:11434/v1', model: 'llama3.1' }

function fetchOk(content: string): typeof fetch {
  return vi.fn(async () =>
    new Response(
      JSON.stringify({ choices: [{ message: { content } }] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
  ) as unknown as typeof fetch
}

afterEach(() => vi.unstubAllGlobals())

describe('chat', () => {
  it('posts to baseURL/chat/completions with the model and returns the content', async () => {
    const f = fetchOk('REWRITTEN')
    vi.stubGlobal('fetch', f)
    const out = await chat(ollama, [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ])
    expect(out).toBe('REWRITTEN')
    const [url, init] = (f as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('http://localhost:11434/v1/chat/completions')
    const body = JSON.parse(init.body)
    expect(body.model).toBe('llama3.1')
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' })
  })

  it('sends a Bearer key only when configured', async () => {
    let seenAuth: string | undefined
    const f = vi.fn(async (_url: string, init: RequestInit) => {
      seenAuth = (init.headers as Record<string, string>).Authorization
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 })
    }) as unknown as typeof fetch
    vi.stubGlobal('fetch', f)
    await chat(ollama, [{ role: 'user', content: 'x' }])
    expect(seenAuth).toBeUndefined()
    await chat({ ...ollama, apiKey: 'sk-k' }, [{ role: 'user', content: 'x' }])
    expect(seenAuth).toBe('Bearer sk-k')
  })

  it('maps a 429 to AiError with its status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('rate limited', { status: 429 })))
    const err = await chat(ollama, [{ role: 'user', content: 'x' }]).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AiError)
    expect((err as AiError).code).toBe('http-429')
  })

  it('maps network failures to AiError network', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
    const err = await chat(ollama, [{ role: 'user', content: 'x' }]).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AiError)
    expect((err as AiError).code).toBe('network')
  })

  it('times out after the configured window', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_res, rej) => {
      init.signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))
    })))
    const p = expect(chat(ollama, [{ role: 'user', content: 'x' }], { timeoutMs: 10 })).rejects.toMatchObject({ code: 'timeout' })
    vi.advanceTimersByTime(50)
    await p
    vi.useRealTimers()
  })
})

describe('listModels', () => {
  it('reads the OpenAI-compatible /models list', async () => {
    const f = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ id: 'llama3.1' }, { id: 'qwen2.5' }] }), { status: 200 }),
    ) as unknown as typeof fetch
    vi.stubGlobal('fetch', f)
    const models = await listModels(ollama)
    expect(models).toEqual(['llama3.1', 'qwen2.5'])
    const [url] = (f as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('http://localhost:11434/v1/models')
  })

  it('falls back to Ollama /api/tags when /models fails', async () => {
    const f = vi.fn(async (url: string) => {
      if (url.endsWith('/models')) return new Response('not found', { status: 404 })
      return new Response(JSON.stringify({ models: [{ name: 'mistral' }] }), { status: 200 })
    }) as unknown as typeof fetch
    vi.stubGlobal('fetch', f)
    const models = await listModels(ollama)
    expect(models).toEqual(['mistral'])
  })

  it('throws AiError network when both fail', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })))
    const err = await listModels(ollama).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AiError)
    expect((err as AiError).code).toBe('network')
  })
})

describe('bring your own key', () => {
  const groq: AiConfig = { provider: 'groq', endpoint: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', apiKey: 'gsk_k' }

  it('sends the key when it lists models', async () => {
    const f = vi.fn(async (_url: string, init: RequestInit) => {
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer gsk_k')
      return new Response(JSON.stringify({ data: [{ id: 'llama-3.3-70b-versatile' }] }), { status: 200 })
    })
    vi.stubGlobal('fetch', f)
    expect(await listModels(groq)).toEqual(['llama-3.3-70b-versatile'])
    expect(f.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/models')
  })

  it('reads a bare array model list (Together)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ id: 'meta-llama/Llama-3.3-70B' }]), { status: 200 })))
    const together: AiConfig = { provider: 'together', endpoint: 'https://api.together.xyz/v1', model: '', apiKey: 'k' }
    expect(await listModels(together)).toEqual(['meta-llama/Llama-3.3-70B'])
  })

  it('reports a rejected key as an HTTP error, not an empty list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    const err = await listModels(groq).catch((e: unknown) => e)
    expect((err as AiError).code).toBe('http-401')
  })

  it('a cloud provider without a key fails before any request', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    const noKey = { ...groq, apiKey: undefined }
    const err = await chat(noKey, [{ role: 'user', content: 'x' }]).catch((e: unknown) => e)
    expect((err as AiError).code).toBe('no-config')
    expect((await listModels(noKey).catch((e: unknown) => e) as AiError).code).toBe('no-config')
    expect(f).not.toHaveBeenCalled()
  })
})
