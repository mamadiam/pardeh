import { useEffect, useState } from 'react'
import { loadAiConfig, saveAiConfig } from '../ai/config'
import { AiError, chat, listModels } from '../ai/client'
import { PROVIDERS, type AiConfig } from '../ai/types'
import { useT } from '../i18n'

export default function AiSettings(props: { open: boolean; onClose: () => void }) {
  const [cfg, setCfg] = useState<AiConfig>(() => loadAiConfig())
  const [models, setModels] = useState<string[]>([])
  const [listFail, setListFail] = useState(false)
  const [tryCount, setTryCount] = useState(0)
  const [testState, setTestState] = useState<{ kind: 'idle' | 'testing' | 'ok' | 'err'; message?: string }>({ kind: 'idle' })
  const closeRef = useState<HTMLButtonElement | null>()
  const t = useT()

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
    <div className="sf-ai-overlay" role="dialog" aria-modal="true" aria-label={t('ai.dialog')}>
      <div className="sf-ai-settings">
        <button ref={closeRef[1] as never} type="button" className="sf-close" aria-label={t('ai.close')} onClick={props.onClose}>×</button>
        <h2>{t('ai.title')}</h2>
        <label>
          {t('ai.provider')}
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
          {t('ai.endpoint')}
          <input
            aria-label={t('ai.endpointLabel')}
            value={cfg.endpoint}
            onChange={(e) => setCfg((c) => ({ ...c, endpoint: e.target.value }))}
            placeholder="http://localhost:11434/v1"
          />
        </label>
        <label>
          <span>{t('ai.model')}</span>
          {models.length > 0 ? (
            <select aria-label={t('ai.modelLabel')} value={cfg.model} onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value }))}>
              <option value="">{t('ai.chooseModel')}</option>
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <input
              aria-label={t('ai.modelLabel')}
              value={cfg.model}
              onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value }))}
              placeholder={t('ai.modelId')}
            />
          )}
        </label>
        {listFail && (
          <p className="sf-ai-note">{t('ai.listFail')}</p>
        )}
        {info.needsKey && (
          <label>
            {cfg.provider === 'opencode' ? t('ai.servicePassword') : t('ai.apiKey')}
            {cfg.provider === 'opencode' && (
              <span className="sf-ai-note">
                {t('ai.opencodeHint')}
              </span>
            )}
            <input
              aria-label={cfg.provider === 'opencode' ? t('ai.servicePasswordLabel') : t('ai.apiKeyLabel')}
              type="password"
              value={cfg.apiKey ?? ''}
              onChange={(e) => setCfg((c) => ({ ...c, apiKey: e.target.value }))}
              placeholder={cfg.provider === 'opencode' ? '8chars-16chars-16chars…' : cfg.provider === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
            />
          </label>
        )}
        <div className="sf-ai-row">
          <button type="button" className="sf-control" onClick={runTest} disabled={testState.kind === 'testing'}>
            {testState.kind === 'testing' ? t('ai.testing') : t('ai.test')}
          </button>
          <button type="button" className="sf-control" onClick={() => setTryCount((t) => t + 1)}>
            {t('ai.refresh')}
          </button>
          <span className={`sf-ai-result sf-${testState.kind}`}>
            {testState.kind === 'ok' ? t('ai.works') : testState.kind === 'err' ? testState.message : ''}
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
            {t('ai.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
