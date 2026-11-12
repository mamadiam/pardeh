import { AiError } from './client'
import { ELEMENT_LABEL } from '../core/flow'
import type { ScreenplayDoc } from '../core/types'
import { writeIn } from './language'

export interface BreakdownResult {
  logline: string
  characters: { name: string; description: string }[]
  locations: string[]
  scenes: { title: string; summary: string }[]
}

export function buildBreakdownPrompt(doc: ScreenplayDoc): { prompt: string; truncated: { kept: number; total: number } | null } {
  const LIMIT = 24_000
  const total = doc.blocks.length
  let kept = 0
  let size = 0
  const lines: string[] = []
  for (const b of doc.blocks) {
    const line = `${ELEMENT_LABEL[b.type]}: ${b.text}`
    if (size + line.length > LIMIT && kept > 0) break
    lines.push(line)
    size += line.length
    kept += 1
  }
  const truncated = kept < total ? { kept, total } : null
  if (truncated) {
    lines.push(`(script truncated after ${kept} of ${total} blocks)`)
  }
  const prompt = [
    'Break down this screenplay. Respond with ONLY a JSON object, no commentary, of this exact shape:',
    '{"logline": string, "characters": [{"name": string, "description": string}], "locations": [string], "scenes": [{"title": string, "summary": string}]}',
    writeIn(doc.direction),
    '---',
    lines.join('\n'),
  ].join('\n')
  return { prompt, truncated }
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

export function parseBreakdown(raw: string): BreakdownResult {
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
  if (typeof p.logline !== 'string') {
    throw new AiError('bad-json', 'Breakdown is missing a logline')
  }
  const characters = Array.isArray(p.characters)
    ? p.characters
      .filter((c): c is { name: string; description: string } =>
        typeof (c as { name?: string }).name === 'string')
      .map((c) => ({ name: c.name, description: typeof c.description === 'string' ? c.description : '' }))
    : []
  const locations = isStringArray(p.locations) ? p.locations : []
  const scenes = Array.isArray(p.scenes)
    ? p.scenes
      .filter((s): s is { title: string; summary: string } =>
        typeof (s as { title?: string }).title === 'string')
      .map((s) => ({ title: s.title, summary: typeof s.summary === 'string' ? s.summary : '' }))
    : []
  return { logline: p.logline, characters, locations, scenes }
}
