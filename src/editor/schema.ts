import { Editor, Node, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import type { JSONContent } from '@tiptap/core'
import {
  type Direction,
  type ElementType,
  type ScreenplayDoc,
  type ScreenplayMeta,
} from '../core/types'
import { ELEMENT_ORDER } from '../core/flow'

export interface BlockAttrs {
  elementType: ElementType
  textAlign?: null
}

export const BlockNode = Node.create({
  name: 'block',
  group: 'block',
  content: 'text*',

  addAttributes() {
    return {
      elementType: {
        default: 'action' as ElementType,
        parseHTML: (el) => el.getAttribute('data-element-type'),
        renderHTML: (attrs) => ({
          'data-element-type': attrs.elementType,
          class: `sf-block sf-${attrs.elementType}`,
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-element-type]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0]
  },
})

export function docToTiptapContent(doc: ScreenplayDoc): JSONContent[] {
    // ProseMirror forbids empty text nodes — empty text content is omitted;
    // tiptapToDoc maps a missing content array back to ''
    return doc.blocks.map((b) => ({
      type: 'block',
      attrs: { elementType: b.type },
      ...(b.text !== '' && { content: [{ type: 'text', text: b.text }] }),
    }))
}

export function tiptapToDoc(
  content: JSONContent[],
  meta: ScreenplayMeta,
  direction: Direction,
): ScreenplayDoc {
  const isElementType = (v: unknown): v is ElementType =>
    typeof v === 'string' && (ELEMENT_ORDER as readonly string[]).includes(v)
  return {
    schemaVersion: 1,
    meta: { ...meta, modified: new Date().toISOString() },
    direction,
    blocks: content
      .filter((n) => n.type === 'block')
      .map((n) => ({
        type:
          isElementType((n.attrs as BlockAttrs | undefined)?.elementType)
            ? ((n.attrs as BlockAttrs).elementType as ElementType)
            : 'action',
        text: (n.content ?? [])
          .filter((c) => c.type === 'text')
          .map((c) => c.text ?? '')
          .join(''),
      })),
  }
}

export function createEditor(doc: ScreenplayDoc): Editor {
  return new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit.configure({ blockquote: false, bulletList: false, codeBlock: false, heading: false, horizontalRule: false, listItem: false, orderedList: false }), BlockNode],
    // TipTap 2.27 turns arrays into Fragments (crashes in EditorState.create):
    // always hand it a complete doc object
    content: { type: 'doc', content: docToTiptapContent(doc) },
  })
}
