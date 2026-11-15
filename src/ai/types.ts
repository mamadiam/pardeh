export type AiProviderId =
  | 'ollama'
  | 'lmstudio'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'mistral'
  | 'deepseek'
  | 'xai'
  | 'groq'
  | 'cohere'
  | 'perplexity'
  | 'together'
  | 'fireworks'
  | 'cerebras'
  | 'qwen'
  | 'moonshot'
  | 'huggingface'
  | 'openrouter'
  | 'opencode'
  | 'custom'

/** local: runs on the writer's machine; cloud: the writer's own key; other: services and custom servers */
export type AiProviderGroup = 'local' | 'cloud' | 'other'

export interface AiProviderInfo {
  id: AiProviderId
  label: string
  group: AiProviderGroup
  baseURL: string
  needsKey: boolean
  /** where the writer creates their own key */
  keyUrl?: string
  /** placeholder for the key field */
  keyHint?: string
  /**
   * the provider may refuse calls made straight from a web page (no CORS);
   * the desktop app will not have this limit
   */
  browserLimited?: boolean
}

export const PROVIDERS: AiProviderInfo[] = [
  { id: 'ollama', label: 'Ollama (local)', group: 'local', baseURL: 'http://localhost:11434/v1', needsKey: false },
  { id: 'lmstudio', label: 'LM Studio (local)', group: 'local', baseURL: 'http://localhost:1234/v1', needsKey: false },

  { id: 'openai', label: 'OpenAI', group: 'cloud', baseURL: 'https://api.openai.com/v1', needsKey: true, keyUrl: 'https://platform.openai.com/api-keys', keyHint: 'sk-…' },
  { id: 'anthropic', label: 'Claude (Anthropic)', group: 'cloud', baseURL: 'https://api.anthropic.com/v1', needsKey: true, keyUrl: 'https://console.anthropic.com/settings/keys', keyHint: 'sk-ant-…' },
  { id: 'gemini', label: 'Gemini (Google)', group: 'cloud', baseURL: 'https://generativelanguage.googleapis.com/v1beta', needsKey: true, keyUrl: 'https://aistudio.google.com/apikey', keyHint: 'AIza…' },
  { id: 'mistral', label: 'Mistral', group: 'cloud', baseURL: 'https://api.mistral.ai/v1', needsKey: true, keyUrl: 'https://console.mistral.ai/api-keys' },
  { id: 'deepseek', label: 'DeepSeek', group: 'cloud', baseURL: 'https://api.deepseek.com/v1', needsKey: true, keyUrl: 'https://platform.deepseek.com/api_keys', keyHint: 'sk-…', browserLimited: true },
  { id: 'xai', label: 'Grok (xAI)', group: 'cloud', baseURL: 'https://api.x.ai/v1', needsKey: true, keyUrl: 'https://console.x.ai', keyHint: 'xai-…' },
  { id: 'groq', label: 'Groq', group: 'cloud', baseURL: 'https://api.groq.com/openai/v1', needsKey: true, keyUrl: 'https://console.groq.com/keys', keyHint: 'gsk_…' },
  { id: 'cohere', label: 'Cohere', group: 'cloud', baseURL: 'https://api.cohere.ai/compatibility/v1', needsKey: true, keyUrl: 'https://dashboard.cohere.com/api-keys' },
  { id: 'perplexity', label: 'Perplexity', group: 'cloud', baseURL: 'https://api.perplexity.ai', needsKey: true, keyUrl: 'https://www.perplexity.ai/settings/api', keyHint: 'pplx-…', browserLimited: true },
  { id: 'together', label: 'Together AI', group: 'cloud', baseURL: 'https://api.together.xyz/v1', needsKey: true, keyUrl: 'https://api.together.xyz/settings/api-keys' },
  { id: 'fireworks', label: 'Fireworks AI', group: 'cloud', baseURL: 'https://api.fireworks.ai/inference/v1', needsKey: true, keyUrl: 'https://fireworks.ai/account/api-keys', keyHint: 'fw_…' },
  { id: 'cerebras', label: 'Cerebras', group: 'cloud', baseURL: 'https://api.cerebras.ai/v1', needsKey: true, keyUrl: 'https://cloud.cerebras.ai', keyHint: 'csk-…' },
  { id: 'qwen', label: 'Qwen (Alibaba Cloud)', group: 'cloud', baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', needsKey: true, keyUrl: 'https://modelstudio.console.alibabacloud.com/', keyHint: 'sk-…', browserLimited: true },
  { id: 'moonshot', label: 'Kimi (Moonshot AI)', group: 'cloud', baseURL: 'https://api.moonshot.ai/v1', needsKey: true, keyUrl: 'https://platform.moonshot.ai/console/api-keys', keyHint: 'sk-…', browserLimited: true },
  { id: 'huggingface', label: 'Hugging Face', group: 'cloud', baseURL: 'https://router.huggingface.co/v1', needsKey: true, keyUrl: 'https://huggingface.co/settings/tokens', keyHint: 'hf_…' },
  { id: 'openrouter', label: 'OpenRouter', group: 'cloud', baseURL: 'https://openrouter.ai/api/v1', needsKey: true, keyUrl: 'https://openrouter.ai/keys', keyHint: 'sk-or-…' },

  { id: 'opencode', label: 'OpenCode (CLI service)', group: 'other', baseURL: 'http://127.0.0.1:49374', needsKey: true },
  { id: 'custom', label: 'Custom (OpenAI-compatible)', group: 'other', baseURL: '', needsKey: false },
]

export function providerInfo(id: AiProviderId): AiProviderInfo {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0]
}

export interface AiConfig {
  provider: AiProviderId
  endpoint: string
  model: string
  /** the key for the active provider */
  apiKey?: string
  /** each provider keeps its own key, so a key is never sent to another service */
  keys?: Partial<Record<AiProviderId, string>>
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  provider: 'ollama',
  endpoint: 'http://localhost:11434/v1',
  model: '',
}
