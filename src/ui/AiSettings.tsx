import { useEffect, useState } from 'react'
import { loadAiConfig, saveAiConfig, switchProvider } from '../ai/config'
import { AiError, chat, listModels } from '../ai/client'
import { PROVIDERS, providerInfo, type AiConfig, type AiProviderGroup, type AiProviderId } from '../ai/types'
import { useT } from '../i18n'
import Dialog from './Dialog'

const GROUPS: AiProviderGroup[] = ['local', 'cloud', 'other']

export default function AiSettings(props: { open: boolean; onClose: () => void }) {
  const [cfg, setCfg] = useState<AiConfig>(() => loadAiConfig())
  const [models, setModels] = useState<string[]>([])
  const [listFail, setListFail] = useState(false)
  const [tryCount, setTryCount] = useState(0)
  const [testState, setTestState] = useState<{ kind: 'idle' | 'testing' | 'ok' | 'err'; message?: string }>({ kind: 'idle' })
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

  if (!props.open) return null

  const info = providerInfo(cfg.provider)
  const isOpencode = cfg.provider === 'opencode'
  const showKey = info.needsKey || cfg.provider === 'custom'

  const setProvider = (id: string) => {
    if (!PROVIDERS.some((p) => p.id === id)) return
    setModels([])
    setCfg((c) => switchProvider(c, id as AiProviderId))
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
    <Dialog label={t('ai.dialog')} onClose={props.onClose}>
      <button type="button" className="sf-close" aria-label={t('ai.close')} onClick={props.onClose}>×</button>
      <h2>{t('ai.title')}</h2>
      <label>
        {t('ai.provider')}
        <select value={cfg.provider} onChange={(e) => setProvider(e.target.value)}>
          {GROUPS.map((g) => (
            <optgroup key={g} label={t(`ai.group.${g}`)}>
              {PROVIDERS.filter((p) => p.group === g).map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label>
        {t('ai.endpoint')}
        <input
          value={cfg.endpoint}
          onChange={(e) => setCfg((c) => ({ ...c, endpoint: e.target.value }))}
          placeholder="http://localhost:11434/v1"
        />
      </label>
      <label>
        <span>{t('ai.model')}</span>
        {models.length > 0 ? (
          <select value={cfg.model} onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value }))}>
            <option value="">{t('ai.chooseModel')}</option>
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        ) : (
          <input
            value={cfg.model}
            onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value }))}
            placeholder={t('ai.modelId')}
          />
        )}
      </label>
      {listFail && <p className="sf-ai-note">{t('ai.listFail')}</p>}
      {showKey && (
        <label>
          {isOpencode ? t('ai.servicePassword') : info.needsKey ? t('ai.apiKey') : t('ai.apiKeyOptional')}
          {isOpencode && <span className="sf-ai-note">{t('ai.opencodeHint')}</span>}
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={cfg.apiKey ?? ''}
            onChange={(e) => setCfg((c) => ({ ...c, apiKey: e.target.value }))}
            placeholder={isOpencode ? '8chars-16chars-16chars…' : (info.keyHint ?? 'sk-…')}
          />
        </label>
      )}
      {info.group === 'cloud' && (
        <p className="sf-ai-note">
          {t('ai.byok')}{' '}
          {info.keyUrl && (
            <a href={info.keyUrl} target="_blank" rel="noreferrer noopener">{t('ai.getKey')}</a>
          )}
        </p>
      )}
      {info.browserLimited && <p className="sf-ai-note sf-ai-warn">{t('ai.browserLimited')}</p>}
      <div className="sf-ai-row">
        <button type="button" className="sf-control" onClick={runTest} disabled={testState.kind === 'testing'}>
          {testState.kind === 'testing' ? t('ai.testing') : t('ai.test')}
        </button>
        <button type="button" className="sf-control" onClick={() => setTryCount((t) => t + 1)}>
          {t('ai.refresh')}
        </button>
        <span className={`sf-ai-result sf-${testState.kind}`} role="status">
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
    </Dialog>
  )
}
