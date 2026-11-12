// The writer's assistant: help where the cursor is. It reads the scene around
// the cursor (plus the headings of earlier scenes for orientation) and either
// suggests ideas, writes lines that fill the gap, or answers a question.
// Nothing reaches the script until the writer chooses to insert it.
import type { Editor, JSONContent } from '@tiptap/core'
import { AiError } from './client'
import { ELEMENT_ORDER } from '../core/flow'
import type { Direction, ElementType, ScreenplayBlock } from '../core/types'
import { writeIn } from './language'

export type AssistMode = 'next' | 'scene' | 'fill' | 'ask'

export interface AssistContext {
  title: string
  direction: Direction
  earlierScenes: string[]
  before: ScreenplayBlock[]
  after: ScreenplayBlock[]
}

const MAX_BEFORE = 40
const MAX_AFTER = 10
const MAX_HEADINGS = 30

/** The scene around block `index`: from its heading up to the cursor, and what follows it. */
export function contextAt(
  blocks: ScreenplayBlock[],
  index: number,
  title: string,
  direction: Direction,
): AssistContext {
  const at = Math.max(0, Math.min(index, blocks.length - 1))
  let sceneStart = 0
  for (let i = at; i >= 0; i--) {
    if (blocks[i]?.type === 'scene') {
      sceneStart = i
      break
    }
  }
  const before = blocks.slice(Math.max(sceneStart, at + 1 - MAX_BEFORE), at + 1).filter((b) => b.text.trim() !== '')
  const after: ScreenplayBlock[] = []
  for (const b of blocks.slice(at + 1)) {
    if (after.length >= MAX_AFTER) break
    if (b.text.trim() !== '') after.push(b)
    if (b.type === 'scene' && after.length > 1) break
  }
  const earlierScenes = blocks
    .slice(0, sceneStart)
    .filter((b) => b.type === 'scene' && b.text.trim() !== '')
    .map((b) => b.text)
    .slice(-MAX_HEADINGS)
  return { title, direction, earlierScenes, before, after }
}

function scriptLines(blocks: ScreenplayBlock[]): string {
  return blocks.map((b) => `${b.type.toUpperCase()}: ${b.text}`).join('\n')
}

const BLOCK_SHAPE = '{"blocks": [{"type": string, "text": string}]}'

export function buildAssistPrompt(mode: AssistMode, ctx: AssistContext, note = ''): { system: string; prompt: string } {
  const system =
    'You are an experienced screenwriting partner helping a writer who is stuck. ' +
    'Be concrete and specific to their characters and situation; avoid clichés and generic advice. ' +
    writeIn(ctx.direction)
  const lines: string[] = []
  if (ctx.title) lines.push(`Screenplay title: ${ctx.title}`)
  if (ctx.earlierScenes.length > 0) lines.push('Earlier scenes:', ...ctx.earlierScenes.map((h) => `- ${h}`))
  lines.push('', 'The current scene up to the cursor:', ctx.before.length > 0 ? scriptLines(ctx.before) : '(the script is empty here)')
  if (ctx.after.length > 0) lines.push('', 'What comes right after the cursor:', scriptLines(ctx.after))
  lines.push('')
  const extra = note.trim()
  switch (mode) {
    case 'next':
      lines.push(
        'Suggest 3 clearly different directions for what could happen next, starting at the cursor.',
        'Each is 1 to 3 sentences, written as a pitch for the next moment or scene.',
      )
      break
    case 'scene':
      lines.push(
        'Give 3 concrete ideas to make the current scene stronger: conflict, subtext, a visual moment, or a better turn.',
        'Each is 1 to 3 sentences and names the characters involved.',
      )
      break
    case 'fill':
      lines.push(
        'Write the next 4 to 12 screenplay elements that continue exactly from the cursor' +
          (ctx.after.length > 0 ? ' and lead naturally into what comes right after.' : '.'),
        'Fully dramatized: action lines and dialogue, not a summary. Do not repeat what is already written.',
        `Element "type" must be one of: ${ELEMENT_ORDER.join(', ')}.`,
      )
      break
    case 'ask':
      lines.push('Answer the writer\'s question below about this script. Be brief and practical.')
      break
  }
  if (extra) lines.push(mode === 'ask' ? `Question: ${extra}` : `The writer's note: ${extra}`)
  if (mode === 'next' || mode === 'scene') {
    lines.push('Respond with ONLY a JSON object: {"ideas": [string, string, string]}')
  } else if (mode === 'fill') {
    lines.push(`Respond with ONLY a JSON object: ${BLOCK_SHAPE}`)
  }
  return { system, prompt: lines.join('\n') }
}

function parseJson(raw: string): Record<string, unknown> {
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  try {
    const parsed: unknown = JSON.parse(start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped)
    if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, unknown>
  } catch {
    // reported below
  }
  throw new AiError('bad-json', 'The assistant did not return usable JSON')
}

export function parseIdeas(raw: string): string[] {
  let ideas: string[] = []
  try {
    const p = parseJson(raw)
    if (Array.isArray(p.ideas)) ideas = p.ideas.filter((x): x is string => typeof x === 'string')
  } catch {
    // models sometimes answer with a plain list; accept it
    ideas = raw
      .split('\n')
      .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
      .filter((l) => l !== '')
  }
  ideas = ideas.map((s) => s.trim()).filter((s) => s !== '')
  if (ideas.length === 0) throw new AiError('bad-json', 'The assistant returned no ideas')
  return ideas.slice(0, 5)
}

export function parseBlocks(raw: string): ScreenplayBlock[] {
  const p = parseJson(raw)
  const blocks = (Array.isArray(p.blocks) ? p.blocks : [])
    .filter((b): b is { type?: unknown; text?: unknown } => typeof b === 'object' && b !== null)
    .map((b) => ({
      type: (ELEMENT_ORDER as readonly unknown[]).includes(b.type) ? (b.type as ElementType) : 'action',
      text: typeof b.text === 'string' ? b.text.trim() : '',
    }))
    .filter((b) => b.text !== '')
  if (blocks.length === 0) throw new AiError('bad-json', 'The assistant wrote no lines')
  return blocks
}

/** Index of the top-level block holding the cursor. */
export function cursorBlockIndex(editor: Editor): number {
  return editor.state.selection.$head.index(0)
}

/**
 * Insert blocks right after the cursor's block, or in place of it when that
 * block is empty. One transaction, so one Ctrl/Cmd+Z removes it all.
 */
export function insertBlocksAtCursor(editor: Editor, blocks: ScreenplayBlock[]): void {
  if (blocks.length === 0) return
  const nodes: JSONContent[] = blocks.map((b) => ({
    type: 'block',
    attrs: { elementType: b.type },
    ...(b.text !== '' && { content: [{ type: 'text', text: b.text }] }),
  }))
  const { $head } = editor.state.selection
  const current = $head.node(1)
  const range = current && current.textContent.trim() === ''
    ? { from: $head.before(1), to: $head.after(1) }
    : $head.after(1)
  editor.chain().focus().insertContentAt(range, nodes).run()
}
