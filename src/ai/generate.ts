import { AiError } from './client'
import type { Direction, ElementType, ScreenplayBlock, ScreenplayDoc } from '../core/types'
import { writeIn } from './language'

export interface GeneratedScene {
  heading: string
  blocks: ScreenplayBlock[]
}

export interface GeneratedPackage {
  title: string
  logline: string
  genre: string
  characters: { name: string; description: string }[]
  scenes: GeneratedScene[]
}

export interface GenerateOptions {
  genre?: string
  continueFrom?: string
  direction?: Direction
}

const ELEMENTS: ElementType[] = ['scene', 'action', 'character', 'parenthetical', 'dialogue', 'transition']

export function buildGeneratePrompt(idea: string, opts: GenerateOptions = {}): { prompt: string } {
  const shape = '{"title": string, "logline": string, "genre": string, "characters": [{"name": string, "description": string}], "scenes": [{"heading": string, "blocks": [{"type": string, "text": string}]}]}'
  const lines = [
    'Write the next chapter of a screenplay from this idea. Respond with ONLY a JSON object, no commentary, of this exact shape:',
    shape,
    'block "type" must be one of: scene, action, character, parenthetical, dialogue, transition.',
    'Write 6 to 8 fully dramatized scenes — dialogue, action lines, transitions — not summaries. Every scene starts with a "heading" (a slugline) and the heading is also the first block as type "scene".',
    writeIn(opts.direction ?? 'ltr'),
  ]
  if (opts.genre) lines.push(`Genre: ${opts.genre}.`)
  if (opts.continueFrom) {
    lines.push(`Continue the story after the scene "${opts.continueFrom}" — do not repeat it. Write the next chapter.`)
  }
  lines.push('---', `Idea: ${idea}`)
  return { prompt: lines.join('\n') }
}

export function parseGenerated(raw: string): GeneratedPackage {
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch {
    throw new AiError('bad-json', 'The assistant did not return usable JSON')
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new AiError('bad-json', 'The assistant did not return usable JSON')
  }
  const p = parsed as Record<string, unknown>
  if (typeof p.title !== 'string' || !Array.isArray(p.scenes) || p.scenes.length === 0) {
    throw new AiError('bad-json', 'Generation is missing a title or scenes')
  }
  const scenes: GeneratedScene[] = p.scenes
    .filter((s): s is { heading: string; blocks?: unknown[] } =>
      typeof (s as { heading?: string }).heading === 'string')
    .map((s) => ({
      heading: s.heading,
      blocks: (Array.isArray(s.blocks) ? s.blocks : [])
        .filter((b): b is { type?: string; text?: string } => typeof b === 'object' && b !== null)
        .map((b) => ({
          type: ELEMENTS.includes(b.type as ElementType) ? (b.type as ElementType) : 'action',
          text: typeof b.text === 'string' ? b.text : '',
        }))
        .filter((b) => b.text !== ''),
    }))
  const characters = Array.isArray(p.characters)
    ? p.characters
      .filter((c): c is { name?: string; description?: string } => typeof c === 'object' && c !== null)
      .map((c) => ({ name: typeof c.name === 'string' ? c.name : '', description: typeof c.description === 'string' ? c.description : '' }))
      .filter((c) => c.name !== '')
    : []
  return {
    title: p.title,
    logline: typeof p.logline === 'string' ? p.logline : '',
    genre: typeof p.genre === 'string' ? p.genre : '',
    characters,
    scenes,
  }
}

export function docFromGenerated(gen: GeneratedPackage, direction: Direction = 'ltr'): ScreenplayDoc {
  const blocks: ScreenplayBlock[] = []
  for (const scene of gen.scenes) {
    blocks.push({ type: 'scene', text: scene.heading })
    blocks.push(...scene.blocks)
  }
  return {
    schemaVersion: 1,
    meta: { title: gen.title, author: '', created: new Date().toISOString(), modified: new Date().toISOString() },
    direction,
    blocks: blocks.length > 0 ? blocks : [{ type: 'action', text: '' }],
  }
}
