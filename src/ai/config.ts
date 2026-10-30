import { DEFAULT_AI_CONFIG, PROVIDERS } from './types'
import type { AiConfig, AiProviderId } from './types'

const KEY = 'sf-ai'

export function saveAiConfig(cfg: AiConfig): void {
  localStorage.setItem(KEY, JSON.stringify(cfg))
}

export function normalizeAiConfig(raw: unknown): AiConfig {
  const cfg = { ...DEFAULT_AI_CONFIG }
  if (typeof raw !== 'object' || raw === null) return cfg
  const r = raw as Record<string, unknown>
  const known = new Set(PROVIDERS.map((p) => p.id))
  if (typeof r.provider === 'string' && known.has(r.provider)) {
    cfg.provider = r.provider as AiProviderId
  }
  if (typeof r.endpoint === 'string' && r.endpoint.trim() !== '') {
    cfg.endpoint = r.endpoint.trim()
  }
  if (typeof r.model === 'string') cfg.model = r.model
  if (typeof r.apiKey === 'string' && r.apiKey !== '') cfg.apiKey = r.apiKey
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
