import { afterEach, describe, expect, it, vi } from 'vitest'
import { PROVIDERS } from '../src/ai/types'
import type { AiConfig } from '../src/ai/types'
import { normalizeAiConfig, switchProvider } from '../src/ai/config'

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
  it('offers the local, cloud and other providers', () => {
    expect(PROVIDERS.map((p) => p.id).sort()).toEqual([
      'anthropic', 'cerebras', 'cohere', 'custom', 'deepseek', 'fireworks', 'gemini', 'groq',
      'huggingface', 'lmstudio', 'mistral', 'moonshot', 'ollama', 'openai', 'opencode', 'openrouter',
      'perplexity', 'qwen', 'together', 'xai',
    ])
  })

  it('every cloud provider needs the writer\'s own key, served over https, with a key link', () => {
    for (const p of PROVIDERS.filter((x) => x.group === 'cloud')) {
      expect(p.needsKey, p.id).toBe(true)
      expect(p.baseURL.startsWith('https://'), p.id).toBe(true)
      expect(p.keyUrl?.startsWith('https://'), p.id).toBe(true)
    }
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
      saveAiConfig({ provider: 'warp-drive' } as unknown as AiConfig)
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

describe('keys per provider', () => {
  it('switching provider never carries the old key along', () => {
    const openai: AiConfig = { provider: 'openai', endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKey: 'sk-openai' }
    const groq = switchProvider(openai, 'groq')
    expect(groq).toMatchObject({ provider: 'groq', endpoint: 'https://api.groq.com/openai/v1', model: '' })
    expect(groq.apiKey).toBeUndefined()
    const back = switchProvider({ ...groq, apiKey: 'gsk_groq' }, 'openai')
    expect(back.apiKey).toBe('sk-openai')
    expect(switchProvider(back, 'groq').apiKey).toBe('gsk_groq')
  })

  it('keeps each key through save and load', async () => {
    const { loadAiConfig, saveAiConfig } = await import('../src/ai/config')
    withStorage(() => {
      const cfg = switchProvider({ provider: 'mistral', endpoint: 'https://api.mistral.ai/v1', model: 'm', apiKey: 'mk' }, 'xai')
      saveAiConfig({ ...cfg, apiKey: 'xai-1' })
      const loaded = loadAiConfig()
      expect(loaded.apiKey).toBe('xai-1')
      expect(loaded.keys).toEqual({ mistral: 'mk', xai: 'xai-1' })
    })
  })

  it('reads the active key from the keys map and drops unknown ids', () => {
    const cfg = normalizeAiConfig({ provider: 'cohere', endpoint: 'x', model: 'c', keys: { cohere: 'co', warp: 'no', groq: 3 } })
    expect(cfg.apiKey).toBe('co')
    expect(cfg.keys).toEqual({ cohere: 'co' })
  })
})
