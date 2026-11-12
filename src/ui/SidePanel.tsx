import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Editor } from '@tiptap/core'
import { AiError, chat } from '../ai/client'
import { loadAiConfig } from '../ai/config'
import { cursorBlockIndex, insertBlocksAtCursor, jumpToBlock, replaceBlocks } from '../ai/assist'
import {
  COMMANDS,
  buildChatMessages,
  estimatePages,
  interpretReply,
  loadHistory,
  parseCommand,
  saveHistory,
  sceneRangeAt,
  scenesOf,
  type ChatTurn,
  type CommandId,
} from '../ai/chat'
import { tiptapToDoc } from '../editor/schema'
import type { Direction, ScreenplayBlock, ScreenplayMeta } from '../core/types'
import { elementLabel, formatNumber, useLang, useT } from '../i18n'

type Tab = 'chat' | 'scenes'

interface Turn extends ChatTurn {
  /** for punch-ups: the scene it was written for, to check it is unchanged before replacing */
  target?: { start: number; end: number; original: string[] }
  done?: 'inserted' | 'replaced' | 'changed'
}

// the panel beside the page: a chat that knows the script (with slash
// commands), and a timeline of scenes. The AI never writes into the script
// by itself; every result waits for the writer's Insert or Replace.
export default function SidePanel(props: {
  editor: Editor
  projectId: string
  meta: ScreenplayMeta
  direction: Direction
  onOpenSettings: () => void
  onOpenGlossary: () => void
  onClose: () => void
}) {
  const t = useT()
  const [tab, setTab] = useState<Tab>('chat')

  return (
    <aside className="sf-panel" aria-label={t('panel.label')}>
      <div className="sf-panel-head">
        <div className="sf-panel-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'chat'} className="sf-panel-tab" onClick={() => setTab('chat')}>
            {t('panel.chat')}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'scenes'} className="sf-panel-tab" onClick={() => setTab('scenes')}>
            {t('panel.scenes')}
          </button>
        </div>
        <button type="button" className="sf-iconbtn" title={t('panel.glossary')} aria-label={t('panel.glossary')} onClick={props.onOpenGlossary}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5v-2Z" />
            <path d="M8 7h8M8 11h6" />
          </svg>
        </button>
        <button type="button" className="sf-iconbtn" title={t('panel.close')} aria-label={t('panel.close')} onClick={props.onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      {tab === 'chat' ? <ChatTab {...props} /> : <ScenesTab editor={props.editor} meta={props.meta} direction={props.direction} />}
    </aside>
  )
}

function useBlocks(editor: Editor, meta: ScreenplayMeta, direction: Direction): ScreenplayBlock[] {
  const read = useCallback(
    () => tiptapToDoc(editor.getJSON().content ?? [], meta, direction).blocks,
    [editor, meta, direction],
  )
  const [blocks, setBlocks] = useState<ScreenplayBlock[]>(read)
  useEffect(() => {
    const update = () => setBlocks(read())
    update()
    editor.on('update', update)
    return () => {
      editor.off('update', update)
    }
  }, [editor, read])
  return blocks
}

// ── Scenes ────────────────────────────────────────────────────

function ScenesTab(props: { editor: Editor; meta: ScreenplayMeta; direction: Direction }) {
  const t = useT()
  const lang = useLang()
  const blocks = useBlocks(props.editor, props.meta, props.direction)
  const scenes = scenesOf(blocks)
  const est = estimatePages(blocks)
  let n = 0
  return (
    <div className="sf-panel-body sf-scenes">
      <p className="sf-scenes-summary">{t('scenes.summary', { scenes: est.scenes, pages: est.pages, minutes: est.minutes })}</p>
      {scenes.length === 0 ? (
        <p className="sf-ai-note">{t('scenes.empty')}</p>
      ) : (
        <ol className="sf-scene-list">
          {scenes.map((s) => {
            const number = s.heading ? ++n : 0
            return (
              <li key={s.index}>
                <button
                  type="button"
                  className="sf-scene-item"
                  aria-label={s.heading ? t('scenes.jump', { n: number }) : t('scenes.opening')}
                  onClick={() => jumpToBlock(props.editor, s.index)}
                >
                  <span className="sf-scene-num">{s.heading ? formatNumber(lang, number) : '·'}</span>
                  <span className="sf-scene-text">
                    <span className="sf-scene-heading">{s.heading || t('scenes.opening')}</span>
                    <span className="sf-scene-meta">{t('scenes.lines', { n: s.lines })}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

// ── Chat ──────────────────────────────────────────────────────

function ChatTab(props: {
  editor: Editor
  projectId: string
  meta: ScreenplayMeta
  direction: Direction
  onOpenSettings: () => void
}) {
  const t = useT()
  const [turns, setTurns] = useState<Turn[]>(() => loadHistory(props.projectId))
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [lastAsk, setLastAsk] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    setTurns(loadHistory(props.projectId))
  }, [props.projectId])

  useEffect(() => {
    saveHistory(props.projectId, turns)
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns, props.projectId])

  const configured = Boolean(loadAiConfig().model)
  const slash = input.startsWith('/') && !input.includes(' ')
  const suggestions = slash ? COMMANDS.filter((c) => `/${c}`.startsWith(input.toLowerCase())) : []

  const send = async (text: string) => {
    const message = text.trim()
    if (message === '' || running) return
    const { command, arg } = parseCommand(message)
    const userTurn: Turn = { role: 'user', text: message }
    setInput('')
    setLastAsk(message)

    const blocks = tiptapToDoc(props.editor.getJSON().content ?? [], props.meta, props.direction).blocks
    const cursorIndex = cursorBlockIndex(props.editor)

    // answered here, without a model
    if (command === 'help') {
      setTurns((ts) => [...ts, userTurn, { role: 'assistant', command, text: '' }])
      return
    }
    if (command === 'pagecount') {
      const est = estimatePages(blocks)
      setTurns((ts) => [...ts, userTurn, { role: 'assistant', command, text: t('chat.pagecount', est) }])
      return
    }
    if (command === 'format' && arg === '') {
      setTurns((ts) => [...ts, userTurn, { role: 'assistant', text: t('chat.needText'), error: true }])
      return
    }

    const history = turns
    setTurns((ts) => [...ts, userTurn])
    setRunning(true)
    try {
      const cfg = loadAiConfig()
      const raw = await chat(cfg, buildChatMessages(command, arg, {
        title: props.meta.title, direction: props.direction, blocks, cursorIndex,
      }, history))
      const reply: Turn = interpretReply(command, raw)
      if (command === 'punchup') {
        const { start, end } = sceneRangeAt(blocks, cursorIndex)
        reply.target = { start, end, original: blocks.slice(start, end + 1).map((b) => b.text) }
      }
      setTurns((ts) => [...ts, reply])
    } catch (e) {
      const msg = e instanceof AiError ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : t('editor.genericError')
      setTurns((ts) => [...ts, { role: 'assistant', text: msg, error: true }])
    } finally {
      setRunning(false)
    }
  }

  const apply = (index: number) => {
    const turn = turns[index]
    if (!turn.blocks) return
    let done: Turn['done'] = 'inserted'
    if (turn.action === 'replace-scene' && turn.target) {
      const now = tiptapToDoc(props.editor.getJSON().content ?? [], props.meta, props.direction).blocks
      const current = now.slice(turn.target.start, turn.target.end + 1).map((b) => b.text)
      if (JSON.stringify(current) === JSON.stringify(turn.target.original)) {
        replaceBlocks(props.editor, turn.target.start, turn.target.end, turn.blocks)
        done = 'replaced'
      } else {
        done = 'changed'
      }
    } else {
      insertBlocksAtCursor(props.editor, turn.blocks)
    }
    setTurns((ts) => ts.map((x, i) => (i === index ? { ...x, done } : x)))
  }

  const insertInstead = (index: number) => {
    const turn = turns[index]
    if (!turn.blocks) return
    insertBlocksAtCursor(props.editor, turn.blocks)
    setTurns((ts) => ts.map((x, i) => (i === index ? { ...x, done: 'inserted' } : x)))
  }

  const pickCommand = (c: CommandId) => {
    setInput(`/${c} `)
    inputRef.current?.focus()
  }

  if (!configured) {
    return (
      <div className="sf-panel-body sf-chat-empty">
        <p>{t('bd.noProvider')}</p>
        <button type="button" className="sf-control" onClick={props.onOpenSettings}>{t('bd.openSettings')}</button>
      </div>
    )
  }

  return (
    <div className="sf-panel-body sf-chat">
      <div className="sf-chat-log" ref={listRef} aria-live="polite">
        {turns.length === 0 && (
          <div className="sf-chat-welcome">
            <h3>{t('chat.welcomeTitle')}</h3>
            <p>{t('chat.welcome')}</p>
            <CommandList onPick={pickCommand} />
          </div>
        )}
        {turns.map((turn, i) => (
          <Message key={i} turn={turn} onApply={() => apply(i)} onInsertInstead={() => insertInstead(i)} onWriteBeat={(beat) => void send(`/scene ${beat}`)} onPick={pickCommand} running={running} />
        ))}
        {running && <p className="sf-chat-thinking" role="status">{t('chat.thinking')}</p>}
        {!running && turns.at(-1)?.error && lastAsk && (
          <button type="button" className="sf-control sf-chat-retry" onClick={() => void send(lastAsk)}>{t('bd.retry')}</button>
        )}
      </div>

      <div className="sf-chat-compose">
        {suggestions.length > 0 && (
          <ul className="sf-chat-suggest" role="listbox" aria-label={t('chat.helpTitle')}>
            {suggestions.map((c) => (
              <li key={c}>
                <button type="button" role="option" aria-selected="false" onClick={() => pickCommand(c)}>
                  <code dir="ltr">/{c}</code> <span>{t(`cmd.${c}`)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="sf-chat-form"
          onSubmit={(e) => {
            e.preventDefault()
            void send(input)
          }}
        >
          <textarea
            ref={inputRef}
            aria-label={t('chat.inputLabel')}
            rows={2}
            value={input}
            placeholder={t('chat.placeholder')}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void send(input)
              }
            }}
          />
          <button type="submit" className="sf-control sf-save" disabled={running || input.trim() === ''}>{t('chat.send')}</button>
        </form>
        <div className="sf-chat-chips">
          {COMMANDS.filter((c) => c !== 'help').map((c) => (
            <button key={c} type="button" dir="ltr" className="sf-chip" title={t(`cmd.${c}`)} onClick={() => pickCommand(c)}>/{c}</button>
          ))}
          {turns.length > 0 && (
            <button type="button" className="sf-chip sf-chip-quiet" onClick={() => setTurns([])}>{t('chat.clear')}</button>
          )}
        </div>
      </div>
    </div>
  )
}

function CommandList(props: { onPick: (c: CommandId) => void }) {
  const t = useT()
  return (
    <ul className="sf-command-list">
      {COMMANDS.filter((c) => c !== 'help').map((c) => (
        <li key={c}>
          <button type="button" onClick={() => props.onPick(c)}>
            <code dir="ltr">/{c}</code>
            <span>{t(`cmd.${c}`)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function Message(props: {
  turn: Turn
  running: boolean
  onApply: () => void
  onInsertInstead: () => void
  onWriteBeat: (beat: string) => void
  onPick: (c: CommandId) => void
}) {
  const t = useT()
  const lang = useLang()
  const { turn } = props
  if (turn.role === 'user') {
    return <div className="sf-msg sf-msg-user"><p>{turn.text}</p></div>
  }
  if (turn.command === 'help') {
    return (
      <div className="sf-msg sf-msg-ai">
        <p className="sf-msg-title">{t('chat.helpTitle')}</p>
        <CommandList onPick={props.onPick} />
      </div>
    )
  }
  return (
    <div className={`sf-msg sf-msg-ai${turn.error ? ' sf-msg-error' : ''}`}>
      {turn.text && <RichText text={turn.text} />}
      {turn.beats && (
        <ol className="sf-assist-ideas">
          {turn.beats.map((beat) => (
            <li key={beat}>
              <p>{beat}</p>
              <button type="button" className="sf-control" disabled={props.running} onClick={() => props.onWriteBeat(beat)}>{t('chat.writeBeat')}</button>
            </li>
          ))}
        </ol>
      )}
      {turn.blocks && (
        <>
          <div className="sf-assist-preview">
            {turn.blocks.map((b, i) => (
              <p key={i} className={`sf-assist-line sf-assist-${b.type}`}>
                <span className="sf-assist-type">{elementLabel(lang, b.type)}</span>
                {b.text}
              </p>
            ))}
          </div>
          {turn.done === 'inserted' && <p className="sf-ai-note">{t('chat.inserted')}</p>}
          {turn.done === 'replaced' && <p className="sf-ai-note">{t('chat.replaced')}</p>}
          {turn.done === 'changed' && <p className="sf-ai-note">{t('chat.sceneChanged')}</p>}
          {turn.done !== 'inserted' && turn.done !== 'replaced' && (
            <div className="sf-ai-row">
              {turn.action === 'replace-scene' && turn.done !== 'changed' ? (
                <>
                  <button type="button" className="sf-control sf-save" onClick={props.onApply}>{t('chat.replaceScene')}</button>
                  <button type="button" className="sf-control" onClick={props.onInsertInstead}>{t('as.insert')}</button>
                </>
              ) : (
                <button type="button" className="sf-control sf-save" onClick={turn.done === 'changed' ? props.onInsertInstead : props.onApply}>{t('as.insert')}</button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Paragraphs, bullet lists and **bold** from a model's plain-text answer, without HTML. */
function RichText(props: { text: string }) {
  const blocks = props.text.replace(/\r/g, '').split(/\n{2,}/)
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter((l) => l.trim() !== '')
        if (lines.length > 0 && lines.every((l) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(l))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ''))}</li>)}
            </ul>
          )
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l.replace(/^#{1,6}\s*/, ''), /^#{1,6}\s/.test(l))}
              </span>
            ))}
          </p>
        )
      })}
    </>
  )
}

function inline(text: string, strong = false): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== '')
  const nodes = parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))
  return strong ? <strong>{nodes}</strong> : nodes
}
