import type { Editor } from '@tiptap/core'
import { useEffect, useState } from 'react'
import { ELEMENT_LABEL } from '../core/flow'
import type { Direction, ElementType } from '../core/types'
import type { AutosaveStatus } from '../storage/autosave'
import { wordCount } from './status'

export default function StatusBar(props: {
  editor: Editor
  currentElement: ElementType
  direction: Direction
  onDirection: (direction: Direction) => void
  saveStatus?: AutosaveStatus
  theme?: 'light' | 'dark'
  onTheme?: () => void
  onOpenAiSettings?: () => void
}) {
  const { editor, currentElement, direction, onDirection } = props
  const [words, setWords] = useState(0)

  useEffect(() => {
    const update = () => {
      const json = editor.getJSON()
      const text =
        (json.content ?? [])
          .filter((n) => n.type === 'block')
          .map((n) =>
            (n.content ?? [])
              .filter((c) => c.type === 'text')
              .map((c) => c.text ?? '')
              .join(''),
          )
          .join(' ')
      setWords(wordCount(text))
    }
    editor.on('update', update)
    update()
    return () => {
      editor.off('update', update)
    }
  }, [editor])

  return (
    <div className="sf-statusbar">
      <span className="sf-status-element">{ELEMENT_LABEL[currentElement]}</span>
      <span className="sf-save-status" data-testid="save-status">
        {props.saveStatus === 'error' ? 'unsaved — storage error' : ''}
      </span>
      <span className="sf-status-words">{words} words</span>
      <span className="sf-divider" aria-hidden="true" />
      <button
        type="button"
        className="sf-control"
        aria-label={`switch writing direction to ${direction === 'ltr' ? 'right-to-left' : 'left-to-right'}`}
        onClick={() => onDirection(direction === 'ltr' ? 'rtl' : 'ltr')}
      >
        {direction === 'ltr' ? 'RTL' : 'LTR'}
      </button>
      {props.onTheme && (
        <button
          type="button"
          className="sf-iconbtn"
          aria-label={`Switch to ${props.theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${props.theme === 'dark' ? 'light' : 'dark'} mode`}
          onClick={props.onTheme}
        >
          {props.theme === 'dark' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          )}
        </button>
      )}
      {props.onOpenAiSettings && (
        <button
          type="button"
          className="sf-iconbtn"
          aria-label="Open AI settings"
          title="AI settings"
          onClick={props.onOpenAiSettings}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.88.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.33-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" />
          </svg>
        </button>
      )}
    </div>
  )
}
