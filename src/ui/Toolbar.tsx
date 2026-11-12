import type { Editor } from '@tiptap/core'
import { ELEMENT_ORDER } from '../core/flow'
import { elementLabel, useLang, useT } from '../i18n'
import type { ElementType } from '../core/types'

export default function Toolbar(props: {
  editor: Editor
  currentElement: ElementType
  onSave: () => void
  onFocus: () => void
  focus: boolean
  onBreakdown?: () => void
  onGenerate?: () => void
  onAssist?: () => void
}) {
  const { editor, currentElement, onSave, onFocus, focus } = props
  const t = useT()
  const lang = useLang()
  return (
    <div className="sf-toolbar">
      <select
        className="sf-control sf-element-select"
        aria-label={t('toolbar.elementType')}
        value={currentElement}
        onChange={(e) =>
          editor.commands.setElementType(e.target.value as ElementType)
        }
      >
        {ELEMENT_ORDER.map((type) => (
          <option key={type} value={type}>
            {elementLabel(lang, type)}
          </option>
        ))}
      </select>
      {props.onAssist && (
        <button type="button" className="sf-control" onClick={props.onAssist}>
          {t('toolbar.assist')}
        </button>
      )}
      {props.onGenerate && (
        <button type="button" className="sf-control" onClick={props.onGenerate}>
          {t('toolbar.generate')}
        </button>
      )}
      {props.onBreakdown && (
        <button type="button" className="sf-control" onClick={props.onBreakdown}>
          {t('toolbar.breakdown')}
        </button>
      )}
      <button type="button" className="sf-control sf-toggle-focus" onClick={onFocus}>
        {focus ? t('toolbar.exitFocus') : t('toolbar.focus')}
      </button>
      <button type="button" className="sf-control sf-save" onClick={onSave}>
        {t('toolbar.save')}
      </button>
    </div>
  )
}
