import { describe, expect, it } from 'vitest'
import {
  ELEMENT_LABEL,
  ELEMENT_ORDER,
  cycleElement,
  hotkeyElement,
  nextOnEnter,
} from '../src/core/flow'

describe('ELEMENT_ORDER', () => {
  it('matches filmnevis order exactly', () => {
    expect(ELEMENT_ORDER).toEqual([
      'scene',
      'action',
      'character',
      'parenthetical',
      'dialogue',
      'transition',
    ])
  })

  it('labels every element in English', () => {
    expect(ELEMENT_LABEL.scene).toBe('Scene Heading')
    expect(ELEMENT_LABEL.dialogue).toBe('Dialogue')
  })
})

describe('nextOnEnter (filmnevis _handle_enter)', () => {
  it('follows the flow map on non-empty blocks', () => {
    expect(nextOnEnter('scene', 'INT. HOUSE - NIGHT')).toBe('action')
    expect(nextOnEnter('action', 'The door creaks.')).toBe('scene')
    expect(nextOnEnter('character', 'SARA')).toBe('dialogue')
    expect(nextOnEnter('dialogue', 'پس کجایی؟')).toBe('character')
    expect(nextOnEnter('parenthetical', 'warm')).toBe('dialogue')
    expect(nextOnEnter('transition', 'CUT TO:')).toBe('scene')
  })

  it('keeps the same element on an empty block (filmnevis:507)', () => {
    expect(nextOnEnter('dialogue', '')).toBe('dialogue')
    expect(nextOnEnter('action', '')).toBe('action')
    expect(nextOnEnter('scene', '')).toBe('scene')
  })

  it('empty overrides the forced overrides too (filmnevis checks type first)', () => {
    // filmnevis order: parenthetical → dialogue, transition → scene, then empty-stays
    expect(nextOnEnter('transition', '')).toBe('scene')
    expect(nextOnEnter('parenthetical', '')).toBe('dialogue')
  })
})

describe('cycleElement', () => {
  it('moves forward and wraps', () => {
    expect(cycleElement('scene', 1)).toBe('action')
    expect(cycleElement('transition', 1)).toBe('scene')
  })

  it('moves backward and wraps', () => {
    expect(cycleElement('scene', -1)).toBe('transition')
    expect(cycleElement('dialogue', -1)).toBe('parenthetical')
  })
})

describe('hotkeyElement', () => {
  it('maps 1..6 to ELEMENT_ORDER, others to null', () => {
    expect(hotkeyElement(1)).toBe('scene')
    expect(hotkeyElement(2)).toBe('action')
    expect(hotkeyElement(3)).toBe('character')
    expect(hotkeyElement(4)).toBe('parenthetical')
    expect(hotkeyElement(5)).toBe('dialogue')
    expect(hotkeyElement(6)).toBe('transition')
    expect(hotkeyElement(7)).toBeNull()
    expect(hotkeyElement(0)).toBeNull()
  })
})
