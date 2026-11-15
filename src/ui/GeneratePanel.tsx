import { useEffect, useState } from 'react'
import { AiError, chat } from '../ai/client'
import { loadAiConfig } from '../ai/config'
import { buildGeneratePrompt, docFromGenerated, parseGenerated } from '../ai/generate'
import type { GeneratedPackage } from '../ai/generate'
import type { Direction, ScreenplayBlock, ScreenplayDoc } from '../core/types'
import { useT } from '../i18n'
import Dialog from './Dialog'

// generation studio: an idea in, a full chapter out — either as a brand new
// project or appended to the open screenplay
export default function GeneratePanel(props: {
  open: boolean
  onClose: () => void
  doc: ScreenplayDoc
  direction: Direction
  onCreated: (doc: ScreenplayDoc) => void
  onAppend: (blocks: ScreenplayBlock[]) => void
}) {
  const [idea, setIdea] = useState('')
  const [genre, setGenre] = useState('')
  const [continueMode, setContinueMode] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GeneratedPackage | null>(null)
  const t = useT()

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
        { role: 'user', content: buildGeneratePrompt(idea, { genre: genre || undefined, continueFrom: lastScene, direction: props.direction }).prompt },
      ])
      const gen = parseGenerated(raw)
      setResult(gen)
      setRunning(false)
    } catch (e) {
      setError(e instanceof AiError ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : t('editor.genericError'))
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
      props.onCreated(docFromGenerated(result, props.direction))
    }
  }

  return (
    <Dialog label={t('gen.dialog')} onClose={props.onClose} className="sf-ai-settings sf-generate">
      <button type="button" className="sf-close" aria-label={t('gen.close')} onClick={props.onClose}>×</button>
      <h2>{t('gen.title')}</h2>
      {continueMode ? (
        <p className="sf-ai-note">{t('gen.noteAppend')}</p>
      ) : (
        <p className="sf-ai-note">{t('gen.noteNew')}</p>
      )}
      {hasScript && (
        <label className="sf-check">
          <input
            type="checkbox"
            aria-label={t('gen.continueLabel')}
            checked={continueMode}
            onChange={(e) => setContinueMode(e.target.checked)}
          />
          {t('gen.continue')}
        </label>
      )}
      <label>
        {t('gen.idea')}
        <textarea
          aria-label={t('gen.ideaLabel')}
          rows={4}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder={t('gen.ideaPlaceholder')}
        />
      </label>
      <label>
        {t('gen.genre')}
        <input
          aria-label={t('gen.genreLabel')}
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          placeholder={t('gen.genrePlaceholder')}
        />
      </label>
      <div className="sf-ai-row">
        <button type="button" className="sf-control sf-save" onClick={run} disabled={running || idea.trim() === ''}>
          {running ? t('gen.writing') : t('gen.run')}
        </button>
        {error && <span className="sf-rewrite-error">{error}</span>}
      </div>
      {result && (
        <div className="sf-generate-result">
          <p className="sf-generate-title">{result.title}</p>
          {result.logline && <p className="sf-ai-note">{result.logline}</p>}
          <p className="sf-ai-note">
            {result.genre && `${result.genre} — `}
            {t('gen.summary', { characters: result.characters.length, scenes: result.scenes.length })}
          </p>
          <button type="button" className="sf-control sf-save" onClick={deliver}>
            {continueMode ? t('gen.append') : t('gen.openNew')}
          </button>
        </div>
      )}
    </Dialog>
  )
}
