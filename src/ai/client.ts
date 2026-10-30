import type { AiConfig } from './types'

export class AiError extends Error {
  code: string
  status?: number

  constructor(code: string, message: string, status?: number) {
    super(message)
    this.name = 'AiError'
    this.code = code
    this.status = status
  }
}

const DEFAULT_TIMEOUT_MS = 60_000

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function request(
  cfg: AiConfig,
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  init.signal = controller.signal
  try {
    return await fetch(`${cfg.endpoint.replace(/\/+$/, '')}${path}`, init)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new AiError('timeout', `request timed out after ${Math.round(timeoutMs / 1000)}s`)
    }
    throw new AiError('network', `could not reach ${cfg.endpoint}`)
  } finally {
    clearTimeout(timer)
  }
}

export async function chat(
  cfg: AiConfig,
  messages: ChatMessage[],
  opts: { timeoutMs?: number } = {},
): Promise<string> {
  if (!cfg.model) throw new AiError('no-config', 'no model selected')
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`
  const res = await request(
    cfg,
    '/chat/completions',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: cfg.model, messages }),
    },
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  )
  if (!res.ok) {
    throw new AiError(`http-${res.status}`, `provider returned HTTP ${res.status}`, res.status)
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new AiError('bad-response', 'provider returned no content')
  return content
}

export interface ProviderError extends AiError {}

export async function listModels(cfg: AiConfig): Promise<string[]> {
  try {
    const res = await request(cfg, '/models', {}, 15_000)
    if (res.status === 404 && cfg.provider !== 'ollama') throw new AiError('network', 'no /models')
    const data = (await res.json()) as { data?: { id?: string }[] }
    const ids = (data.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === 'string')
    return ids
  } catch (e) {
    if (e instanceof AiError) throw e
    // ollama's native catalogue at /api/tags
    try {
      const tagsUrl = `${cfg.endpoint.replace(/\/v\d+$/, '')}/api/tags`
      const res = await fetch(tagsUrl, { signal: AbortSignal.timeout(15_000) })
      if (res.ok) {
        const data = (await res.json()) as { models?: { name?: string }[] }
        const names = (data.models ?? []).map((m) => m.name).filter((n): n is string => typeof n === 'string')
        return names
      }
    } catch {
      // falls through to the error below
    }
    throw new AiError('network', `could not list models at ${cfg.endpoint}`)
  }
}
