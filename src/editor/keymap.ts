import { Extension } from '@tiptap/core'
import type { CommandProps } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { ElementType } from '../core/types'
import { cycleElement as cycle, hotkeyElement, nextOnEnter } from '../core/flow'

declare module '@tiptap/core' {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  interface Commands<ReturnType> {
    smartKeys: {
      smartEnter: () => ReturnType
      cycleElement: (step: 1 | -1) => ReturnType
      setElementType: (elementType: ElementType) => ReturnType
    }
  }
}

function currentBlockOf({ state }: CommandProps) {
  const $from = state.selection.$from
  const blockStart = $from.start() - 1
  const block = state.doc.nodeAt(blockStart) ?? $from.parent
  return {
    blockStart,
    block,
    elementType: block.attrs.elementType as ElementType,
    textBefore:
      ($from.parent as PMNode).textBetween(0, $from.parentOffset) ?? '',
  }
}

export const SmartKeys = Extension.create({
  name: 'smartKeys',

  addCommands() {
    return {
      smartEnter:
        () =>
        ({ state, tr, dispatch }) => {
          if (!dispatch) return true
          const { $head } = state.selection
          const textBefore =
          ($head.parent as PMNode).textBetween(0, $head.parentOffset) ?? ''
          const next = nextOnEnter(
            ($head.parent.attrs.elementType ?? 'action') as ElementType,
            textBefore,
          )
          const blockIndex = $head.index(0)
          tr.split($head.pos, $head.depth)
          // the split keeps the block at blockIndex; the new one follows it
          let blockStart = 0
          for (let i = 0; i <= blockIndex; i++) blockStart += tr.doc.child(i).nodeSize
          tr.setNodeMarkup(blockStart, undefined, { elementType: next })
          tr.setSelection(TextSelection.near(tr.doc.resolve(blockStart + 1), 1))
          tr.scrollIntoView()
          return true
        },

      cycleElement:
        (step) =>
        (props) => {
          if (!props.dispatch) return true
          const { elementType } = currentBlockOf(props)
          props.tr.setNodeMarkup(blockStartOf(props), undefined, {
            elementType: cycle(elementType, step),
          })
          return true
        },

      setElementType:
        (elementType) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return true
          const $from = state.selection.$from
          tr.setNodeMarkup($from.start() - 1, undefined, { elementType })
          return true
        },
    }

    function blockStartOf({ state }: CommandProps): number {
      return state.selection.$from.start() - 1
    }
  },

  addKeyboardShortcuts() {
    const hotkeys: Record<string, () => boolean> = {}
    for (let i = 1; i <= 6; i++) {
      hotkeys[`Mod-${i}`] = () => {
        const el = hotkeyElement(i)
        return el ? this.editor.commands.setElementType(el) : false
      }
    }
    return {
      Enter: () => this.editor.commands.smartEnter(),
      Tab: () => this.editor.commands.cycleElement(1),
      'Shift-Tab': () => this.editor.commands.cycleElement(-1),
      // filmnevis editor.py:485 — "(" on an empty block switches to Parenthetical
      // and swallows the character
      '(': () => {
        const { $head } = this.editor.state.selection
        if ($head.parentOffset === 0 && this.editor.state.selection.empty) {
          return this.editor.commands.setElementType('parenthetical')
        }
        return false
      },
      ...hotkeys,
    }
  },
})
