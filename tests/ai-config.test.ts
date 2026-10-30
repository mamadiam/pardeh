import { afterEach, describe, expect, it, vi } from 'vitest'
import { PROVIDERS } from '../src/ai/types'

function withStorage<T>(fn: () => T): T {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
  try {
    return fn()
  } finally {
    vi.unstubAllGlobals()
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('PROVIDERS registry', () => {
  it('offers ollama, lmstudio, openai, openrouter, custom', () => {
    expect(PROVIDERS.map((p) => p.id).sort()).toEqual([
      'custom',
      'lmstudio',
      'ollama',
      'openai',
      'openrouter',
    ])
  })

  it('local providers need no key, cloud ones do', () => {
    const byId = Object.fromEntries(PROVIDERS.map((p) => [p.id, p]))
    expect(byId.ollama.needsKey).toBe(false)
    expect(byId.lmstudio.needsKey).toBe(false)
    expect(byId.openai.needsKey).toBe(true)
    expect(byId.openrouter.needsKey).toBe(true)
    expect(byId.ollama.baseURL).toBe('http://localhost:11434/v1')
    expect(byId.lmstudio.baseURL).toBe('http://localhost:1234/v1')
    expect(byId.openai.baseURL).toBe('https://api.openai.com/v1')
    expect(byId.openrouter.baseURL).toBe('https://openrouter.ai/api/v1')
  })
})

describe('ai config storage', () => {
  it('round trips through localStorage', async () => {
    const { loadAiConfig, saveAiConfig } = await import('../src/ai/config')
    withStorage(() => {
      saveAiConfig({
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        apiKey: 'sk-test',
      })
      const cfg = loadAiConfig()
      expect(cfg.provider).toBe('openai')
      expect(cfg.model).toBe('gpt-4o-mini')
      expect(cfg.apiKey).toBe('sk-test')
    })
  })

  it('defaults to ollama and falls back on unknown provider id', async () => {
    const { loadAiConfig, saveAiConfig } = await import('../src/ai/config')
    withStorage(() => {
      saveAiConfig({ provider: 'warp-drive' as never })
      const cfg = loadAiConfig()
      expect(cfg.provider).toBe('ollama')
      expect(cfg.endpoint).toBe('http://localhost:11434/v1')
      // garbage in storage must not throw
      localStorage.setItem('sf-ai', '{nonsense')
      expect(loadAiConfig().provider).toBe('ollama')
    })
  })

  it('an empty store yields the default ollama config', async () => {
    const { loadAiConfig } = await import('../src/ai/config')
    withStorage(() => {
      const cfg = loadAiConfig()
      expect(cfg.provider).toBe('ollama')
      expect(cfg.model).toBe('')
      expect(cfg.apiKey).toBeUndefined()
    })
  })
})
