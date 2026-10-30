import { useEffect, useState } from 'react'
import { loadAiConfig, saveAiConfig } from '../ai/config'
import { AiError, chat, listModels } from '../ai/client'
import { PROVIDERS, type AiConfig } from '../ai/types'

export default function AiSettings(props: { open: boolean; onClose: () => void }) {
  const [cfg, setCfg] = useState<AiConfig>(() => loadAiConfig())
  const [models, setModels] = useState<string[]>([])
  const [listFail, setListFail] = useState(false)
  const [tryCount, setTryCount] = useState(0)
  const [testState, setTestState] = useState<{ kind: 'idle' | 'testing' | 'ok' | 'err'; message?: string }>({ kind: 'idle' })
  const closeRef = useState<HTMLButtonElement | null>()

  useEffect(() => {
    if (!props.open) return
    setCfg(loadAiConfig())
    setModels([])
    setListFail(false)
    setTryCount(0)
    setTestState({ kind: 'idle' })
  }, [props.open])

  useEffect(() => {
    if (!props.open) return
    let alive = true
    listModels(cfg)
      .then((list) => {
        if (alive) {
          setModels(list)
          setListFail(false)
        }
      })
      .catch(() => {
        if (alive) {
          setModels([])
          setListFail(true)
        }
      })
    return () => {
      alive = false
    }
  }, [cfg.endpoint, cfg.provider, tryCount, props.open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Esc closes (aria-modal dialog)
  useEffect(() => {
    if (!props.open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props])

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
    <div className="sf-ai-overlay" role="dialog" aria-modal="true" aria-label="AI settings">
      <div className="sf-ai-settings">
        <button ref={closeRef[1] as never} type="button" className="sf-close" aria-label="close settings" onClick={props.onClose}>×</button>
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
          <span>Model</span>
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
        {listFail && (
          <p className="sf-ai-note">Couldn't list models — type the model id, or refresh once the server is up.</p>
        )}
        {info.needsKey && (
          <label>
            {cfg.provider === 'opencode' ? 'Service password' : 'API key'}
            {cfg.provider === 'opencode' && (
              <span className="sf-ai-note">
                ← run `opencode service status` (or read ~/.config/opencode/service.json) and paste the password once.
              </span>
            )}
            <input
              aria-label={cfg.provider === 'opencode' ? 'service password' : 'api key'}
              type="password"
              value={cfg.apiKey ?? ''}
              onChange={(e) => setCfg((c) => ({ ...c, apiKey: e.target.value }))}
              placeholder={cfg.provider === 'opencode' ? '8chars-16chars-16chars…' : 'sk-…'}
            />
          </label>
        )}
        <div className="sf-ai-row">
          <button type="button" className="sf-control" onClick={runTest} disabled={testState.kind === 'testing'}>
            {testState.kind === 'testing' ? 'Testing…' : 'Test connection'}
          </button>
          <button type="button" className="sf-control" onClick={() => setTryCount((t) => t + 1)}>
            Refresh models
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
    </div>
  )
}
