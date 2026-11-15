import { DEFAULT_AI_CONFIG, PROVIDERS, providerInfo } from './types'
import type { AiConfig, AiProviderId } from './types'

const KEY = 'sf-ai'

export function saveAiConfig(cfg: AiConfig): void {
  localStorage.setItem(KEY, JSON.stringify(withActiveKey(cfg)))
}

/** records the active key under its provider (or removes it when empty) */
function withActiveKey(cfg: AiConfig): AiConfig {
  const keys = { ...cfg.keys }
  if (cfg.apiKey) keys[cfg.provider] = cfg.apiKey
  else delete keys[cfg.provider]
  const out: AiConfig = { provider: cfg.provider, endpoint: cfg.endpoint, model: cfg.model }
  if (cfg.apiKey) out.apiKey = cfg.apiKey
  if (Object.keys(keys).length > 0) out.keys = keys
  return out
}

/**
 * Switches provider: the endpoint becomes the provider's default, the model is
 * cleared, and the key becomes the one saved for that provider (never the old one).
 */
export function switchProvider(cfg: AiConfig, id: AiProviderId): AiConfig {
  if (id === cfg.provider) return cfg
  const stored = withActiveKey(cfg)
  const next = providerInfo(id)
  const out: AiConfig = {
    provider: next.id,
    endpoint: next.baseURL || cfg.endpoint,
    model: '',
  }
  if (stored.keys) out.keys = stored.keys
  const key = stored.keys?.[next.id]
  if (key) out.apiKey = key
  return out
}

export function normalizeAiConfig(raw: unknown): AiConfig {
  const cfg: AiConfig = { ...DEFAULT_AI_CONFIG }
  if (typeof raw !== 'object' || raw === null) return cfg
  const r = raw as Record<string, unknown>
  const known = new Set<string>(PROVIDERS.map((p) => p.id))
  if (typeof r.provider === 'string' && known.has(r.provider)) {
    cfg.provider = r.provider as AiProviderId
  }
  if (typeof r.endpoint === 'string' && r.endpoint.trim() !== '') {
    cfg.endpoint = r.endpoint.trim()
  }
  if (typeof r.model === 'string') cfg.model = r.model
  if (typeof r.keys === 'object' && r.keys !== null) {
    const keys: Partial<Record<AiProviderId, string>> = {}
    for (const [id, key] of Object.entries(r.keys as Record<string, unknown>)) {
      if (known.has(id) && typeof key === 'string' && key !== '') keys[id as AiProviderId] = key
    }
    if (Object.keys(keys).length > 0) cfg.keys = keys
  }
  // older configs have only `apiKey`: it belongs to the saved provider
  if (typeof r.apiKey === 'string' && r.apiKey !== '') cfg.apiKey = r.apiKey
  else if (cfg.keys?.[cfg.provider]) cfg.apiKey = cfg.keys[cfg.provider]
  return cfg
}

export function loadAiConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return { ...DEFAULT_AI_CONFIG }
    return normalizeAiConfig(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_AI_CONFIG }
  }
}
