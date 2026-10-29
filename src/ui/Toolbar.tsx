import type { Editor } from '@tiptap/core'
import { ELEMENT_LABEL } from '../core/flow'
import type { ElementType } from '../core/types'
import { ELEMENT_ORDER } from '../core/flow'

export default function Toolbar(props: {
  editor: Editor
  currentElement: ElementType
  onSave: () => void
  onFocus: () => void
  focus: boolean
}) {
  const { editor, currentElement, onSave, onFocus, focus } = props
  return (
    <div className="sf-toolbar">
      <select
        aria-label="element type"
        value={currentElement}
        onChange={(e) =>
          editor.commands.setElementType(e.target.value as ElementType)
        }
      >
        {ELEMENT_ORDER.map((type) => (
          <option key={type} value={type}>
            {ELEMENT_LABEL[type]}
          </option>
        ))}
      </select>
      <button type="button" onClick={onSave}>
        Save
      </button>
      <button type="button" className="sf-toggle-focus" onClick={onFocus}>
        {focus ? 'Exit focus' : 'Focus'}
      </button>
    </div>
  )
}
