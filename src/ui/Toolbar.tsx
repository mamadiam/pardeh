import type { Editor } from '@tiptap/core'
import { ELEMENT_LABEL, ELEMENT_ORDER } from '../core/flow'
import type { ElementType } from '../core/types'

export default function Toolbar(props: {
  editor: Editor
  currentElement: ElementType
  onSave: () => void
  onFocus: () => void
  focus: boolean
  onBreakdown?: () => void
  onGenerate?: () => void
}) {
  const { editor, currentElement, onSave, onFocus, focus } = props
  return (
    <div className="sf-toolbar">
      <select
        className="sf-control sf-element-select"
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
      {props.onGenerate && (
        <button type="button" className="sf-control" onClick={props.onGenerate}>
          Generate
        </button>
      )}
      {props.onBreakdown && (
        <button type="button" className="sf-control" onClick={props.onBreakdown}>
          Breakdown
        </button>
      )}
      <button type="button" className="sf-control sf-toggle-focus" onClick={onFocus}>
        {focus ? 'Exit focus' : 'Focus'}
      </button>
      <button type="button" className="sf-control sf-save" onClick={onSave}>
        Save
      </button>
    </div>
  )
}
