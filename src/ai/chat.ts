// The chat beside the page: free conversation about the script plus slash
// commands. Pure logic here (parsing, prompts, interpreting replies, page
// estimates); the panel in src/ui/ChatPanel.tsx does the talking.
import type { ChatMessage } from './client'
import { AiError } from './client'
import { parseBlocks, parseIdeas } from './assist'
import { writeIn } from './language'
import type { Direction, ScreenplayBlock } from '../core/types'

export type CommandId = 'scene' | 'outline' | 'character' | 'punchup' | 'format' | 'coverage' | 'pagecount' | 'help'

/** In the order shown to the writer. */
export const COMMANDS: CommandId[] = ['scene', 'outline', 'character', 'punchup', 'format', 'coverage', 'pagecount', 'help']

/** Commands answered locally, with no model call. */
export const LOCAL_COMMANDS: CommandId[] = ['pagecount', 'help']

export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
  command?: CommandId
  /** script lines the writer can insert, or use to replace the current scene */
  blocks?: ScreenplayBlock[]
  action?: 'insert' | 'replace-scene'
  /** outline beats, each can become a scene */
  beats?: string[]
  error?: boolean
}

export function parseCommand(input: string): { command: CommandId | null; arg: string } {
  const m = input.trim().match(/^\/([a-z]+)\b\s*([\s\S]*)$/i)
  if (m && (COMMANDS as string[]).includes(m[1].toLowerCase())) {
    return { command: m[1].toLowerCase() as CommandId, arg: m[2].trim() }
  }
  return { command: null, arg: input.trim() }
}

// ── script helpers ────────────────────────────────────────────

export interface SceneEntry {
  index: number
  heading: string
  lines: number
}

/** Scene headings in order, with where each starts; text before the first heading is an untitled opening. */
export function scenesOf(blocks: ScreenplayBlock[]): SceneEntry[] {
  const scenes: SceneEntry[] = []
  blocks.forEach((b, i) => {
    if (b.type === 'scene') scenes.push({ index: i, heading: b.text.trim(), lines: 0 })
    else if (b.text.trim() !== '') {
      if (scenes.length === 0) scenes.push({ index: 0, heading: '', lines: 0 })
      scenes[scenes.length - 1].lines += 1
    }
  })
  return scenes.filter((s) => s.heading !== '' || s.lines > 0)
}

/** The scene holding block `index`: from its heading to the block before the next heading. */
export function sceneRangeAt(blocks: ScreenplayBlock[], index: number): { start: number; end: number } {
  const at = Math.max(0, Math.min(index, blocks.length - 1))
  let start = 0
  for (let i = at; i >= 0; i--) {
    if (blocks[i]?.type === 'scene') {
      start = i
      break
    }
  }
  let end = blocks.length - 1
  for (let i = at + 1; i < blocks.length; i++) {
    if (blocks[i].type === 'scene') {
      end = i - 1
      break
    }
  }
  return { start, end }
}

// Industry rule of thumb: one formatted page ≈ 55 lines ≈ one minute of screen time.
const LINES_PER_PAGE = 55
const WIDTH: Record<ScreenplayBlock['type'], number> = {
  scene: 61, action: 61, character: 38, parenthetical: 25, dialogue: 35, transition: 20,
}
const GAP_BEFORE: Record<ScreenplayBlock['type'], number> = {
  scene: 1, action: 1, character: 1, parenthetical: 0, dialogue: 0, transition: 1,
}

export function estimatePages(blocks: ScreenplayBlock[]): { pages: number; minutes: number; scenes: number; words: number } {
  let lines = 0
  let words = 0
  blocks.forEach((b, i) => {
    const text = b.text.trim()
    if (text === '') return
    words += text.split(/\s+/).length
    if (i > 0) lines += GAP_BEFORE[b.type]
    lines += text.split('\n').reduce((n, part) => n + Math.max(1, Math.ceil(part.length / WIDTH[b.type])), 0)
  })
  const pages = Math.round((lines / LINES_PER_PAGE) * 10) / 10
  return { pages, minutes: words > 0 ? Math.max(1, Math.round(pages)) : 0, scenes: scenesOf(blocks).filter((s) => s.heading !== '').length, words }
}

const SCRIPT_LIMIT = 16_000

/** The script as labelled lines; when long, keep every heading and the most recent text. */
export function scriptText(blocks: ScreenplayBlock[]): string {
  const lines = blocks.filter((b) => b.text.trim() !== '').map((b) => `${b.type.toUpperCase()}: ${b.text}`)
  const full = lines.join('\n')
  if (full.length <= SCRIPT_LIMIT) return full
  const kept: string[] = []
  let size = 0
  for (let i = lines.length - 1; i >= 0 && size < SCRIPT_LIMIT * 0.75; i--) {
    kept.unshift(lines[i])
    size += lines[i].length
  }
  const headings = lines.slice(0, lines.length - kept.length).filter((l) => l.startsWith('SCENE:'))
  return ['(earlier scenes, headings only)', ...headings, '(…)', ...kept].join('\n')
}

// ── prompts ───────────────────────────────────────────────────

export interface ChatContext {
  title: string
  direction: Direction
  blocks: ScreenplayBlock[]
  cursorIndex: number
}

const BLOCKS_JSON = 'Respond with ONLY a JSON object: {"blocks": [{"type": string, "text": string}]}. ' +
  'Element "type" must be one of: scene, action, character, parenthetical, dialogue, transition.'

function taskFor(command: CommandId | null, arg: string, ctx: ChatContext): string {
  const { start, end } = sceneRangeAt(ctx.blocks, ctx.cursorIndex)
  switch (command) {
    case 'scene':
      return [
        arg
          ? `Write one complete, fully dramatized scene for this pitch: ${arg}`
          : 'Write the next scene, continuing the story from where the cursor is.',
        'It must fit the story so far. Start with a scene heading. Action and dialogue, not a summary.',
        BLOCKS_JSON,
      ].join('\n')
    case 'outline':
      return [
        `Make a beat outline${arg ? ` for: ${arg}` : ' for this story, building on what is already written'}.`,
        '8 to 15 beats in story order, each one or two sentences naming who does what and what changes.',
        'Respond with ONLY a JSON object: {"ideas": [string, ...]}',
      ].join('\n')
    case 'character':
      return [
        `Develop this character${arg ? `: ${arg}` : ': the most important character in the script so far'}.`,
        'Give: name; role in the story; what they want; what they need; their flaw; how they talk, with two sample lines; their arc.',
        'Use short labelled sections.',
      ].join('\n')
    case 'punchup': {
      const scene = ctx.blocks.slice(start, end + 1).filter((b) => b.text.trim() !== '')
      return [
        'Punch up the current scene: sharper, more specific dialogue with subtext; tighter, more visual action lines; better rhythm.',
        'Keep the same events, characters and order. Return the whole revised scene.',
        arg ? `The writer's note: ${arg}` : '',
        'The current scene:',
        scene.map((b) => `${b.type.toUpperCase()}: ${b.text}`).join('\n'),
        BLOCKS_JSON,
      ].filter(Boolean).join('\n')
    }
    case 'format':
      return [
        'Convert this rough text into properly formatted screenplay elements.',
        'Keep the writer\'s wording and events; do not add new story. Split speech into character + dialogue.',
        `Text:\n${arg}`,
        BLOCKS_JSON,
      ].join('\n')
    case 'coverage':
      return [
        'Write script coverage like a professional studio reader, for what is written so far.',
        'Sections: Logline; Synopsis (3 to 5 sentences); Strengths; Weaknesses; Notes on structure, character and dialogue; ' +
          'Verdict (Pass, Consider or Recommend) with a one-line reason.',
        arg ? `Focus especially on: ${arg}` : '',
      ].filter(Boolean).join('\n')
    default:
      return `The writer says: ${arg}\nAnswer as a thoughtful writing partner, briefly and specifically.`
  }
}

export function buildChatMessages(
  command: CommandId | null,
  arg: string,
  ctx: ChatContext,
  history: ChatTurn[],
): ChatMessage[] {
  const system =
    'You are a screenwriting partner inside Pardeh, a screenplay editor. You know the writer\'s script below. ' +
    'Be concrete and specific to their story; avoid clichés and generic advice. ' + writeIn(ctx.direction)
  const { start } = sceneRangeAt(ctx.blocks, ctx.cursorIndex)
  const heading = ctx.blocks[start]?.type === 'scene' ? ctx.blocks[start].text : ''
  const script = [
    ctx.title ? `Title: ${ctx.title}` : '',
    'The script so far:',
    scriptText(ctx.blocks) || '(empty)',
    heading ? `The cursor is in the scene: ${heading}` : '',
  ].filter(Boolean).join('\n')
  const past: ChatMessage[] = history
    .filter((t) => !t.error)
    .slice(-8)
    .map((t) => ({
      role: t.role,
      content: t.blocks ? `${t.text}\n(${t.blocks.length} script lines)` : t.beats ? t.beats.join('\n') : t.text,
    }))
  return [
    { role: 'system', content: system },
    { role: 'user', content: script },
    { role: 'assistant', content: 'I have read the script.' },
    ...past,
    { role: 'user', content: taskFor(command, arg, ctx) },
  ]
}

/** Turn the model's reply into a chat turn the panel can show and act on. */
export function interpretReply(command: CommandId | null, raw: string): ChatTurn {
  switch (command) {
    case 'scene':
    case 'format':
      return { role: 'assistant', text: '', command, blocks: parseBlocks(raw), action: 'insert' }
    case 'punchup':
      return { role: 'assistant', text: '', command, blocks: parseBlocks(raw), action: 'replace-scene' }
    case 'outline':
      return { role: 'assistant', text: '', command, beats: parseOutline(raw) }
    default: {
      const text = raw.trim()
      if (text === '') throw new AiError('bad-response', 'The assistant returned nothing')
      return { role: 'assistant', text, command: command ?? undefined }
    }
  }
}

// outlines run longer than the idea list, so take every beat
function parseOutline(raw: string): string[] {
  try {
    const stripped = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
    const parsed = JSON.parse(stripped.slice(stripped.indexOf('{'), stripped.lastIndexOf('}') + 1)) as { ideas?: unknown }
    if (Array.isArray(parsed.ideas)) {
      const beats = parsed.ideas.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim())
      if (beats.length > 0) return beats
    }
  } catch {
    // fall back to the list reader
  }
  return parseIdeas(raw)
}

// ── history ───────────────────────────────────────────────────

const HISTORY_LIMIT = 60

export function loadHistory(projectId: string): ChatTurn[] {
  try {
    const raw = localStorage.getItem(`sf-chat:${projectId}`)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as ChatTurn[]).filter((t) => t && (t.role === 'user' || t.role === 'assistant')) : []
  } catch {
    return []
  }
}

export function saveHistory(projectId: string, turns: ChatTurn[]): void {
  try {
    localStorage.setItem(`sf-chat:${projectId}`, JSON.stringify(turns.slice(-HISTORY_LIMIT)))
  } catch {
    // storage full or unavailable: the chat still works for this session
  }
}
