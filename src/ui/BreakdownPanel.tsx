import { useEffect, useState } from 'react'
import { AiError, chat } from '../ai/client'
import { loadAiConfig } from '../ai/config'
import { buildBreakdownPrompt, parseBreakdown } from '../ai/breakdown'
import type { BreakdownResult } from '../ai/breakdown'
import type { ScreenplayDoc } from '../core/types'
import { useT } from '../i18n'

export default function BreakdownPanel(props: {
  open: boolean
  onClose: () => void
  doc: ScreenplayDoc
  onOpenSettings: () => void
}) {
  const [result, setResult] = useState<BreakdownResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [truncNote, setTruncNote] = useState<string | null>(null)
  const t = useT()

  // all hooks run before any early return (rules of hooks)
  useEffect(() => {
    if (!props.open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props])

  if (!props.open) return null

  const cfg = loadAiConfig()
  const configured = Boolean(cfg.model)

  const run = async () => {
    setRunning(true)
    setError(null)
    try {
      const raw = await chat(cfg, [
        { role: 'system', content: 'You are a script analysis assistant. Output ONLY valid JSON.' },
        { role: 'user', content: buildBreakdownPrompt(props.doc).prompt },
      ])
      setResult(parseBreakdown(raw))
      setTruncNote(buildBreakdownPrompt(props.doc).truncated
        ? t('bd.truncated', { kept: buildBreakdownPrompt(props.doc).truncated!.kept, total: buildBreakdownPrompt(props.doc).truncated!.total })
        : null)
      setRunning(false)
    } catch (e) {
      setError(
        e instanceof AiError
          ? `${e.code}: ${e.message}`
          : e instanceof Error ? e.message : t('editor.genericError'),
      )
      setRunning(false)
    }
  }

  return (
    <div className="sf-ai-overlay" role="dialog" aria-modal="true" aria-label={t('bd.dialog')}>
      <div className="sf-breakdown">
        <button type="button" className="sf-close" aria-label={t('bd.close')} onClick={props.onClose}>×</button>
        <h2 className="sf-doc-title">{t('bd.title')}</h2>
        {!configured ? (
          <div className="sf-breakdown-state">
            <p>{t('bd.noProvider')}</p>
            <button type="button" className="sf-control" onClick={props.onOpenSettings}>{t('bd.openSettings')}</button>
          </div>
        ) : running ? (
          <>
            <p className="sf-breakdown-kicker">{t('bd.reading')}</p>
            <p className="sf-breakdown-loading">{t('bd.willAppear')}</p>
          </>
        ) : error ? (
          <div className="sf-breakdown-state">
            <p className="sf-ai-result sf-err">{error}</p>
            <button type="button" className="sf-control" onClick={run}>{t('bd.retry')}</button>
          </div>
        ) : result ? (
          <div className="sf-breakdown-body">
            <p className="sf-breakdown-logline">{result.logline}</p>
            {result.characters.length > 0 && (
              <section>
                <h3>{t('bd.characters')}</h3>
                <ul>
                  {result.characters.map((c) => (
                    <li key={c.name}>
                      <strong>{c.name}</strong>
                      {c.description && <span className="sf-breakdown-desc"> {c.description}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {result.locations.length > 0 && (
              <section>
                <h3>{t('bd.locations')}</h3>
                <p>{result.locations.join(' · ')}</p>
              </section>
            )}
            {result.scenes.length > 0 && (
              <section>
                <h3>{t('bd.scenes')}</h3>
                <ul>
                  {result.scenes.map((s) => (
                    <li key={s.title}>
                      <strong>{s.title}</strong>
                      {s.summary && <span className="sf-breakdown-desc"> {s.summary}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        ) : (
          <div className="sf-breakdown-state">
            <p>{t('bd.intro', { model: cfg.model })}</p>
            <button type="button" className="sf-control sf-save" onClick={run}>{t('bd.run')}</button>
          </div>
        )}
        {truncNote && result && <p className="sf-breakdown-loading">{truncNote}</p>}
      </div>
    </div>
  )
}
