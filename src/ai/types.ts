export type AiProviderId = 'ollama' | 'lmstudio' | 'openai' | 'openrouter' | 'custom'

export interface AiProviderInfo {
  id: AiProviderId
  label: string
  baseURL: string
  needsKey: boolean
}

export const PROVIDERS: AiProviderInfo[] = [
  { id: 'ollama', label: 'Ollama (local)', baseURL: 'http://localhost:11434/v1', needsKey: false },
  { id: 'lmstudio', label: 'LM Studio (local)', baseURL: 'http://localhost:1234/v1', needsKey: false },
  { id: 'openai', label: 'OpenAI', baseURL: 'https://api.openai.com/v1', needsKey: true },
  { id: 'openrouter', label: 'OpenRouter', baseURL: 'https://openrouter.ai/api/v1', needsKey: true },
  { id: 'custom', label: 'Custom (OpenAI-compatible)', baseURL: '', needsKey: false },
]

export interface AiConfig {
  provider: AiProviderId
  endpoint: string
  model: string
  apiKey?: string
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  provider: 'ollama',
  endpoint: 'http://localhost:11434/v1',
  model: '',
}
