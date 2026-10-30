import type { Editor } from '@tiptap/core'
import { AiError, chat } from './client'
import { loadAiConfig } from './config'
import { nextOnEnter as _flow } from '../core/flow'
import type { ElementType } from '../core/types'

export type RewriteKind = 'Polish' | 'Shorten' | 'Expand' | 'custom'

const INSTRUCTIONS: Record<Exclude<RewriteKind, 'custom'>, string> = {
  Polish: 'Polish this text: fix grammar, rhythm and flow. Keep its meaning and voice.',
  Shorten: 'Shorten this text: keep the essential meaning in fewer words.',
  Expand: 'Expand this text: add concrete detail without changing its meaning.',
}

function blockTextAt(editor: Editor, pos: number): { type: ElementType; text: string } {
  const $pos = editor.state.doc.resolve(pos)
  const block = $startOf($pos)
  return { type: (block.attrs.elementType ?? 'action') as ElementType, text: block.textContent }

  function $startOf(p: typeof $pos) {
    let node = p.parent
    let depth = p.depth
    while (depth > 0 && node.type.name !== 'block') {
      depth -= 1
      node = p.doc.resolve(p.pos).node(depth)
    }
    return node
  }
}

export const REWRITE_SYSTEM = 'You are a screenwriting assistant. Output ONLY the rewritten text — no quotes, no commentary, no labels. Preserve the script\'s language, register and right-to-left/left-to-right directionality.'

export async function rewriteSelection(
  editor: Editor,
  kind: RewriteKind | string,
  opts: { customInstruction?: string } = {},
): Promise<boolean> {
  const { from, to, empty } = editor.state.selection
  if (empty) return false
  const cfg = loadAiConfig()
  if (!cfg.model) throw new AiError('no-config', 'No AI provider is configured')
  const block = blockTextAt(editor, from)
  const selection = editor.state.doc.textBetween(from, to, '\n')
  const instruction = kind === 'custom' ? opts.customInstruction ?? '' : INSTRUCTIONS[kind as Exclude<RewriteKind, 'custom'>]
  void _flow
  const result = await chat(cfg, [
    { role: 'system', content: REWRITE_SYSTEM },
    {
      role: 'user',
      content: [
        `Element: ${block.type}`,
        `Full line: ${block.text || '(empty)'}`,
        `Selected text: ${selection}`,
        `Instruction: ${instruction}`,
        'Rewrite only the selected text.',
      ].join('\n'),
    },
  ])
  const cleaned = result.trim()
  if (!cleaned) throw new AiError('empty-response', 'The assistant returned nothing to insert')
  // replace exactly the selected range; plain text insert (no styles carried in)
  editor.chain().focus().insertContentAt({ from, to }, cleaned, { applyInputRules: false, applyPasteRules: false }).run()
  return true
}
