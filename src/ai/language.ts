// Which language the model must write in. The writer's mode decides it, not a
// guess from the text: Persian mode always gets Persian, even when the idea or
// note was typed in English.
import type { Direction } from '../core/types'

export function writeIn(direction: Direction): string {
  return direction === 'rtl'
    ? 'LANGUAGE: Write every piece of text in Persian (Farsi), in natural, idiomatic Persian screenwriting style, ' +
        'even if the idea, note or question is written in English. Scene headings use the Persian form, ' +
        'for example «داخلی. کافه — شب». Write character names in Persian script. ' +
        'Keep JSON keys and element "type" values in English exactly as specified.'
    : 'LANGUAGE: Write in the same language as the script (English if it is empty). ' +
        'Keep JSON keys and element "type" values in English exactly as specified.'
}
