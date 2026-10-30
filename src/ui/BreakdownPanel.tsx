import { useState } from 'react'
import { AiError, chat } from '../ai/client'
import { loadAiConfig } from '../ai/config'
import { buildBreakdownPrompt, parseBreakdown } from '../ai/breakdown'
import type { BreakdownResult } from '../ai/breakdown'
import type { ScreenplayDoc } from '../core/types'

export default function BreakdownPanel(props: {
  open: boolean
  onClose: () => void
  doc: ScreenplayDoc
  onOpenSettings: () => void
}) {
  const [result, setResult] = useState<BreakdownResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!props.open) return null

  const cfg = loadAiConfig()
  const configured = Boolean(cfg.model)

  const run = async () => {
    setRunning(true)
    setError(null)
    try {
      const raw = await chat(cfg, [
        { role: 'system', content: 'You are a script analysis assistant. Output ONLY valid JSON.' },
        { role: 'user', content: buildBreakdownPrompt(props.doc) },
      ])
      setResult(parseBreakdown(raw))
      setRunning(false)
    } catch (e) {
      setError(
        e instanceof AiError
          ? `${e.code}: ${e.message}`
          : e instanceof Error ? e.message : 'Something went wrong',
      )
      setRunning(false)
    }
  }

  return (
    <div className="sf-ai-overlay" role="dialog" aria-modal="true" aria-label="script breakdown">
      <div className="sf-breakdown">
        <button type="button" className="sf-close" aria-label="close breakdown" onClick={props.onClose}>×</button>
        <h2 className="sf-doc-title">Breakdown</h2>
        {!configured ? (
          <div className="sf-breakdown-state">
            <p>No provider configured. Open AI settings to pick a model.</p>
            <button type="button" className="sf-control" onClick={props.onOpenSettings}>Open settings</button>
          </div>
        ) : running ? (
          <>
            <p className="sf-breakdown-kicker">Reading the script…</p>
            <p className="sf-breakdown-loading">Logline, characters, locations and scenes will appear here.</p>
          </>
        ) : error ? (
          <div className="sf-breakdown-state">
            <p className="sf-ai-result sf-err">{error}</p>
            <button type="button" className="sf-control" onClick={run}>Retry</button>
          </div>
        ) : result ? (
          <div className="sf-breakdown-body">
            <p className="sf-breakdown-logline">{result.logline}</p>
            {result.characters.length > 0 && (
              <section>
                <h3>Characters</h3>
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
                <h3>Locations</h3>
                <p>{result.locations.join(' · ')}</p>
              </section>
            )}
            {result.scenes.length > 0 && (
              <section>
                <h3>Scenes</h3>
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
            <p>Sends the whole script to {cfg.model}. A rerun costs another request.</p>
            <button type="button" className="sf-control sf-save" onClick={run}>Run breakdown</button>
          </div>
        )}
      </div>
    </div>
  )
}
