import { afterAll, describe, expect, it, vi } from 'vitest'
import type { AiConfig } from '../src/ai/types'

const calls: { path: string; init?: RequestInit }[] = []
const originalFetch = globalThis.fetch

afterAll(() => {
  globalThis.fetch = originalFetch
})

function mockFetch(responses: unknown[]) {
  let i = 0
  globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    const path = new URL(String(_url)).pathname
    calls.push({ path, init })
    const res = responses[i++] ?? {}
    return new Response(JSON.stringify(res), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
}

const CODECFG: AiConfig = {
  provider: 'opencode',
  endpoint: 'http://127.0.0.1:49374',
  model: 'opencode/deepseek-v4.1-flash-free',
  apiKey: 'svc-secret',
}

describe('opencode provider', () => {
  it('chat runs session → generate → returns text and removes the session', async () => {
    mockFetch([{ data: { id: 'ses_1' } }, { data: { text: 'PONG' } }])
    const { chat } = await import('../src/ai/client')
    const out = await chat(CODECFG, [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
    ])
    expect(out).toBe('PONG')
    const paths = calls.map((c) => c.path)
    expect(paths).toEqual(['/api/session', '/api/session/ses_1/generate', '/api/session/ses_1'])
    const gen = JSON.parse(String(calls[1].init?.body))
    expect(gen.prompt).toContain('sys')
    expect(gen.prompt).toContain('hi')
    const sess = JSON.parse(String(calls[0].init?.body))
    expect(sess.model).toEqual({ providerID: 'opencode', id: 'deepseek-v4.1-flash-free' })
    // basic auth headers on every call
    expect(calls[1].init?.headers).toEqual({
      'content-type': 'application/json',
      Authorization: `Basic ${btoa('opencode:svc-secret')}`,
    })
    expect(String(calls[2].init?.method)).toBe('DELETE')
  })

  it('listModels composes providerID/modelID from /api/model', async () => {
    mockFetch([{ data: [
      { providerID: 'opencode', id: 'glm', type: 'chat' },
      { providerID: 'openrouter', id: 'z-ai/x', type: 'chat' },
      { providerID: 'opencode', id: 'embedding-1', type: 'other' },
    ] }])
    const { listModels } = await import('../src/ai/client')
    const ids = await listModels(CODECFG)
    expect(ids).toEqual(['opencode/glm', 'openrouter/z-ai/x'])
  })

  it('fails with no-config when the service password is missing', async () => {
    const { chat, AiError } = await import('../src/ai/client')
    await expect(chat({ ...CODECFG, apiKey: undefined }, [{ role: 'user', content: 'x' }])).rejects.toMatchObject({
      name: AiError ? 'AiError' : 'AiError',
      code: 'no-config',
    })
  })

  it('registry lists the CLI service with the right endpoint', async () => {
    const { PROVIDERS } = await import('../src/ai/types')
    const p = PROVIDERS.find((x) => x.id === 'opencode')
    expect(p?.baseURL).toBe('http://127.0.0.1:49374')
  })
})
