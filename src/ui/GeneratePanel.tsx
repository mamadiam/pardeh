import { useEffect, useState } from 'react'
import { AiError, chat } from '../ai/client'
import { loadAiConfig } from '../ai/config'
import { buildGeneratePrompt, docFromGenerated, parseGenerated } from '../ai/generate'
import type { GeneratedPackage } from '../ai/generate'
import type { ScreenplayBlock, ScreenplayDoc } from '../core/types'

// generation studio: an idea in, a full chapter out — either as a brand new
// project or appended to the open screenplay
export default function GeneratePanel(props: {
  open: boolean
  onClose: () => void
  doc: ScreenplayDoc
  onCreated: (doc: ScreenplayDoc) => void
  onAppend: (blocks: ScreenplayBlock[]) => void
}) {
  const [idea, setIdea] = useState('')
  const [genre, setGenre] = useState('')
  const [continueMode, setContinueMode] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GeneratedPackage | null>(null)

  const hasScript = props.doc?.blocks.some((b) => b.text.trim() !== '') ?? false

  useEffect(() => {
    if (!props.open) return
    setIdea('')
    setGenre('')
    setContinueMode(false)
    setRunning(false)
    setError(null)
    setResult(null)
  }, [props.open])

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

  const cfg = loadAiConfig()

  const run = async () => {
    setRunning(true)
    setError(null)
    const lastScene = continueMode
      ? [...props.doc.blocks].reverse().find((b) => b.type === 'scene' && b.text.trim() !== '')?.text
      : undefined
    try {
      const raw = await chat(cfg, [
        { role: 'system', content: 'You are a screenwriter. Output ONLY valid JSON.' },
        { role: 'user', content: buildGeneratePrompt(idea, { genre: genre || undefined, continueFrom: lastScene }).prompt },
      ])
      const gen = parseGenerated(raw)
      setResult(gen)
      setRunning(false)
    } catch (e) {
      setError(e instanceof AiError ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : 'Something went wrong')
      setRunning(false)
    }
  }

  const deliver = () => {
    if (!result) return
    if (continueMode) {
      const gen = result
      const blocks: ScreenplayBlock[] = []
      for (const scene of gen.scenes) {
        blocks.push({ type: 'scene', text: scene.heading })
        blocks.push(...scene.blocks)
      }
      props.onAppend(blocks)
    } else {
      props.onCreated(docFromGenerated(result))
    }
  }

  return (
    <div className="sf-ai-overlay" role="dialog" aria-modal="true" aria-label="generate screenplay">
      <div className="sf-ai-settings sf-generate">
        <button type="button" className="sf-close" aria-label="close generate" onClick={props.onClose}>×</button>
        <h2>Generate</h2>
        {continueMode ? (
          <p className="sf-ai-note">Appends the new chapter to the open screenplay, continuing after its last scene.</p>
        ) : (
          <p className="sf-ai-note">Creates a new screenplay: title, characters, and a fully written first chapter of scenes.</p>
        )}
        {hasScript && (
          <label className="sf-check">
            <input
              type="checkbox"
              aria-label="continue current screenplay"
              checked={continueMode}
              onChange={(e) => setContinueMode(e.target.checked)}
            />
            Continue current screenplay
          </label>
        )}
        <label>
          Idea
          <textarea
            aria-label="idea"
            rows={4}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="A lighthouse keeper finds a mermaid tangled in his nets…"
          />
        </label>
        <label>
          Genre (optional)
          <input
            aria-label="genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="noir, comedy, …"
          />
        </label>
        <div className="sf-ai-row">
          <button type="button" className="sf-control sf-save" onClick={run} disabled={running || idea.trim() === ''}>
            {running ? 'Writing…' : 'Generate'}
          </button>
          {error && <span className="sf-rewrite-error">{error}</span>}
        </div>
        {result && (
          <div className="sf-generate-result">
            <p className="sf-generate-title">{result.title}</p>
            {result.logline && <p className="sf-ai-note">{result.logline}</p>}
            <p className="sf-ai-note">
              {result.genre && `${result.genre} — `}
              {result.characters.length} characters, {result.scenes.length} scenes
            </p>
            <button type="button" className="sf-control sf-save" onClick={deliver}>
              {continueMode ? 'Append chapter' : 'Open as new project'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
