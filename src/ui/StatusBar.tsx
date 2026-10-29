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
      <span className="sf-status-words">{words} words</span>
      <span className="sf-save-status" data-testid="save-status">
        {props.saveStatus === 'error' ? 'unsaved — storage error' : ''}
      </span>
      <button type="button" onClick={() => onDirection(direction === 'ltr' ? 'rtl' : 'ltr')}>
        {direction === 'ltr' ? 'RTL' : 'LTR'}
      </button>
    </div>
  )
}
