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

// the user's own opencode CLI service: not OpenAI-compatible. Every action is
// one throwaway session: POST /api/session → /generate → DELETE.
// Auth is HTTP basic with the password from `~/.config/opencode/service.json`
// (shown by `opencode service status`), stored in cfg.apiKey.
function basicAuth(cfg: AiConfig): Record<string, string> {
  if (!cfg.apiKey) throw new AiError('no-config', 'opencode service password missing')
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  headers.Authorization = `Basic ${btoa(`opencode:${cfg.apiKey}`)}`
  return headers
}

async function opencodeChat(
  cfg: AiConfig,
  messages: ChatMessage[],
  opts: { timeoutMs?: number },
): Promise<string> {
  const headers = basicAuth(cfg)
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const cut = cfg.model.indexOf('/')
  const [providerID, modelID] = cut < 0 ? ['opencode', cfg.model] : [cfg.model.slice(0, cut), cfg.model.slice(cut + 1)]
  const created = await request(
    cfg,
    '/api/session',
    { method: 'POST', headers, body: JSON.stringify({ title: 'screenforge', model: { providerID, id: modelID } }) },
    timeoutMs,
  )
  if (!created.ok) throw new AiError(`http-${created.status}`, `provider returned HTTP ${created.status}`, created.status)
  const createdBody = (await created.json()) as { data?: { id?: string } }
  const sessionID = createdBody.data?.id
  if (typeof sessionID !== 'string') throw new AiError('bad-response', 'opencode did not return a session id')
  try {
    const res = await request(
      cfg,
      `/api/session/${sessionID}/generate`,
      { method: 'POST', headers, body: JSON.stringify({ prompt: messages.map((m) => m.content).join('\n\n') }) },
      timeoutMs,
    )
    if (!res.ok) throw new AiError(`http-${res.status}`, `provider returned HTTP ${res.status}`, res.status)
    const body = (await res.json()) as { data?: { text?: string } }
    if (typeof body.data?.text !== 'string') throw new AiError('bad-response', 'opencode returned no text')
    return body.data.text
  } finally {
    void request(cfg, `/api/session/${sessionID}`, { method: 'DELETE', headers }, 5_000).catch(() => {})
  }
}

export async function chat(
  cfg: AiConfig,
  messages: ChatMessage[],
  opts: { timeoutMs?: number } = {},
): Promise<string> {
  if (!cfg.model) throw new AiError('no-config', 'no model selected')
  if (cfg.provider === 'opencode') return opencodeChat(cfg, messages, opts)
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
  if (cfg.provider === 'opencode') return listOpencodeModels(cfg)
  try {
    const res = await request(cfg, '/models', {}, 15_000)
    if (res.status === 404 && cfg.provider !== 'ollama') throw new AiError('network', 'no /models')
    const data = (await res.json()) as { data?: { id?: string }[] }
    const ids = (data.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === 'string')
    return ids
  } catch (e) {
    // ollama's native catalogue at /api/tags — every failure path falls back
    // except a non-ollama provider's own structured answer
    if (e instanceof AiError && cfg.provider !== 'ollama') throw e
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

// the CLI service exposes its whole account catalogue at /api/model
async function listOpencodeModels(cfg: AiConfig): Promise<string[]> {
  const headers = basicAuth(cfg)
  const res = await request(cfg, '/api/model', { headers }, 15_000)
  if (!res.ok) throw new AiError(`http-${res.status}`, `provider returned HTTP ${res.status}`, res.status)
  const data = (await res.json()) as { data?: { providerID?: string; id?: string; type?: string }[] }
  const list = data.data ?? []
  return list
    .filter((m) => m.type !== 'other' && typeof m.id === 'string' && typeof m.providerID === 'string')
    .map((m) => `${m.providerID}/${m.id}`)
}
