import { useEffect, useState } from 'react'
import { loadAiConfig, saveAiConfig } from '../ai/config'
import { AiError, chat, listModels } from '../ai/client'
import { PROVIDERS } from '../ai/types'
import type { AiConfig } from '../ai/types'

export default function AiSettings(props: { open: boolean; onClose: () => void }) {
  const [cfg, setCfg] = useState<AiConfig>(() => loadAiConfig())
  const [models, setModels] = useState<string[]>([])
  const [testState, setTestState] = useState<{ kind: 'idle' | 'testing' | 'ok' | 'err'; message?: string }>({ kind: 'idle' })

  useEffect(() => {
    if (!props.open) return
    setCfg(loadAiConfig())
    setModels([])
    setTestState({ kind: 'idle' })
  }, [props.open])

  useEffect(() => {
    if (!props.open) return
    let alive = true
    listModels(cfg)
      .then((list) => {
        if (alive) setModels(list)
      })
      .catch(() => {
        if (alive) setModels([])
      })
    return () => {
      alive = false
    }
  }, [cfg.endpoint, cfg.provider, props.open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!props.open) return null

  const info = PROVIDERS.find((p) => p.id === cfg.provider) ?? PROVIDERS[0]

  const setProvider = (id: string) => {
    const p = PROVIDERS.find((x) => x.id === id)
    if (!p) return
    setCfg((c) => ({ ...c, provider: p.id, endpoint: p.baseURL || c.endpoint }))
  }

  const runTest = async () => {
    setTestState({ kind: 'testing' })
    try {
      await chat(cfg, [
        { role: 'system', content: 'ping' },
        { role: 'user', content: 'Reply with the single word ok.' },
      ], { timeoutMs: 30_000 })
      setTestState({ kind: 'ok' })
    } catch (e) {
      const msg = e instanceof AiError ? `${e.code}: ${e.message}` : String(e)
      setTestState({ kind: 'err', message: msg })
    }
  }

  return (
    <div className="sf-ai-settings" role="dialog" aria-modal="true" aria-label="AI settings">
      <button type="button" className="sf-close" aria-label="close settings" onClick={props.onClose}>×</button>
      <h2>AI</h2>
      <label>
        Provider
        <select
          value={cfg.provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </label>
      <label>
        Endpoint
        <input
          aria-label="endpoint"
          value={cfg.endpoint}
          onChange={(e) => setCfg((c) => ({ ...c, endpoint: e.target.value }))}
          placeholder="http://localhost:11434/v1"
        />
      </label>
      <label>
        Model
        {models.length > 0 ? (
          <select aria-label="model" value={cfg.model} onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value }))}>
            <option value="">choose a model…</option>
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        ) : (
          <input
            aria-label="model"
            value={cfg.model}
            onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value }))}
            placeholder="model id"
          />
        )}
      </label>
      {info.needsKey && (
        <label>
          API key
          <input
            aria-label="api key"
            type="password"
            value={cfg.apiKey ?? ''}
            onChange={(e) => setCfg((c) => ({ ...c, apiKey: e.target.value }))}
            placeholder="sk-…"
          />
        </label>
      )}
      <div className="sf-ai-row">
        <button type="button" className="sf-control" onClick={runTest} disabled={testState.kind === 'testing'}>
          {testState.kind === 'testing' ? 'Testing…' : 'Test connection'}
        </button>
        <span className={`sf-ai-result sf-${testState.kind}`}>
          {testState.kind === 'ok' ? 'Works' : testState.kind === 'err' ? testState.message : ''}
        </span>
      </div>
      <div className="sf-ai-actions">
        <button
          type="button"
          className="sf-control sf-save"
          onClick={() => {
            saveAiConfig(cfg)
            props.onClose()
          }}
        >
          Save
        </button>
      </div>
    </div>
  )
}
