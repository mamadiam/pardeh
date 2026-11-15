import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { AiError, chat } from '../ai/client'
import { loadAiConfig } from '../ai/config'
import {
  buildAssistPrompt,
  contextAt,
  cursorBlockIndex,
  insertBlocksAtCursor,
  parseBlocks,
  parseIdeas,
  type AssistContext,
  type AssistMode,
} from '../ai/assist'
import { tiptapToDoc } from '../editor/schema'
import type { Direction, ScreenplayBlock, ScreenplayMeta } from '../core/types'
import { elementLabel, useLang, useT } from '../i18n'
import Dialog from './Dialog'

type Result =
  | { kind: 'ideas'; ideas: string[] }
  | { kind: 'blocks'; blocks: ScreenplayBlock[] }
  | { kind: 'answer'; text: string }

// help where the writer is stuck: ideas, lines that fill the gap, or answers.
// Reads the scene around the cursor; writes into the script only on "Insert".
export default function AssistPanel(props: {
  open: boolean
  onClose: () => void
  editor: Editor
  meta: ScreenplayMeta
  direction: Direction
  onOpenSettings: () => void
}) {
  const t = useT()
  const lang = useLang()
  const [note, setNote] = useState('')
  const [ctx, setCtx] = useState<AssistContext | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [last, setLast] = useState<{ mode: AssistMode; note: string } | null>(null)

  // snapshot the scene around the cursor each time the panel opens
  useEffect(() => {
    if (!props.open) return
    const doc = tiptapToDoc(props.editor.getJSON().content ?? [], props.meta, props.direction)
    setCtx(contextAt(doc.blocks, cursorBlockIndex(props.editor), props.meta.title, props.direction))
    setNote('')
    setRunning(false)
    setError(null)
    setResult(null)
    setLast(null)
  }, [props.open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!props.open || !ctx) return null

  const cfg = loadAiConfig()
  const configured = Boolean(cfg.model)
  const sceneHeading = ctx.before.find((b) => b.type === 'scene')?.text

  const run = async (mode: AssistMode, withNote: string) => {
    setRunning(true)
    setError(null)
    setLast({ mode, note: withNote })
    try {
      const { system, prompt } = buildAssistPrompt(mode, ctx, withNote)
      const raw = await chat(cfg, [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ])
      if (mode === 'fill') setResult({ kind: 'blocks', blocks: parseBlocks(raw) })
      else if (mode === 'ask') setResult({ kind: 'answer', text: raw.trim() })
      else setResult({ kind: 'ideas', ideas: parseIdeas(raw) })
    } catch (e) {
      setError(e instanceof AiError ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : t('editor.genericError'))
    } finally {
      setRunning(false)
    }
  }

  const insert = (blocks: ScreenplayBlock[]) => {
    insertBlocksAtCursor(props.editor, blocks)
    props.onClose()
  }

  return (
    <Dialog label={t('as.dialog')} onClose={props.onClose} className="sf-ai-settings sf-assist">
      <button type="button" className="sf-close" aria-label={t('as.close')} onClick={props.onClose}>×</button>
      <h2>{t('as.title')}</h2>
      {!configured ? (
        <div className="sf-breakdown-state">
          <p>{t('bd.noProvider')}</p>
          <button type="button" className="sf-control" onClick={props.onOpenSettings}>{t('bd.openSettings')}</button>
        </div>
      ) : (
        <>
          <p className="sf-ai-note">
            {t('as.where', { scene: sceneHeading || t('as.whereStart') })}
            <br />
            {t('as.hint')}
          </p>
          <div className="sf-assist-actions">
            <button type="button" className="sf-control" disabled={running} onClick={() => run('next', note)}>{t('as.next')}</button>
            <button type="button" className="sf-control" disabled={running} onClick={() => run('scene', note)}>{t('as.scene')}</button>
            <button type="button" className="sf-control" disabled={running} onClick={() => run('fill', note)}>{t('as.fill')}</button>
          </div>
          <form
            className="sf-assist-ask"
            onSubmit={(e) => {
              e.preventDefault()
              if (note.trim()) void run('ask', note)
            }}
          >
            <textarea
              aria-label={t('as.noteLabel')}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && note.trim()) {
                  e.preventDefault()
                  void run('ask', note)
                }
              }}
              placeholder={t('as.notePlaceholder')}
            />
            <button type="submit" className="sf-control sf-save" disabled={running || note.trim() === ''}>{t('as.ask')}</button>
          </form>

          {running && <p className="sf-breakdown-loading" role="status">{t('as.thinking')}</p>}

          {!running && error && (
            <div className="sf-breakdown-state">
              <p className="sf-ai-result sf-err">{error}</p>
              {last && (
                <button type="button" className="sf-control" onClick={() => run(last.mode, last.note)}>{t('bd.retry')}</button>
              )}
            </div>
          )}

          {!running && !error && result?.kind === 'ideas' && (
            <ol className="sf-assist-ideas">
              {result.ideas.map((idea) => (
                <li key={idea}>
                  <p>{idea}</p>
                  <button type="button" className="sf-control" onClick={() => run('fill', idea)}>{t('as.writeThis')}</button>
                </li>
              ))}
            </ol>
          )}

          {!running && !error && result?.kind === 'blocks' && (
            <div className="sf-assist-result">
              <div className="sf-assist-preview">
                {result.blocks.map((b, i) => (
                  <p key={i} className={`sf-assist-line sf-assist-${b.type}`}>
                    <span className="sf-assist-type">{elementLabel(lang, b.type)}</span>
                    {b.text}
                  </p>
                ))}
              </div>
              <div className="sf-ai-row">
                <button type="button" className="sf-control sf-save" onClick={() => insert(result.blocks)}>{t('as.insert')}</button>
                {last && (
                  <button type="button" className="sf-control" onClick={() => run(last.mode, last.note)}>{t('as.again')}</button>
                )}
              </div>
            </div>
          )}

          {!running && !error && result?.kind === 'answer' && (
            <div className="sf-assist-result">
              <p className="sf-assist-answer">{result.text}</p>
            </div>
          )}
        </>
      )}
    </Dialog>
  )
}
