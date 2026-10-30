import { readFileSync } from 'fs'
import { describe, expect, it, vi } from 'vitest'

// C1: the AI surfaces are overlays — their positioning rules must exist in the
// shipped stylesheet (jsdom cannot cascade class-based position rules).
describe('C1: overlay positioning css shipped', () => {
  const css = readFileSync('src/App.css', 'utf8')
  it('positions the settings dialog fixed and centred', () => {
    expect(css).toMatch(/\.sf-ai-overlay\s*{[^}]*position:\s*fixed/s)
    expect(css).toMatch(/\.sf-ai-settings\s*{[^}]*border-radius/s)
  })
  it('positions the selection menu fixed', () => {
    expect(css).toMatch(/\.sf-selection-menu\s*{[^}]*position:\s*fixed/s)
  })
  it('keeps the text box tall enough to click anywhere on the page', () => {
    const blocks = readFileSync('src/editor/blocks.css', 'utf8')
    expect(blocks).toMatch(/\[role=['"]textbox['"]\]\s*{[^}]*min-height:\s*40rem/s)
  })
})

// I3: menu clamping is a pure function — top of viewport and right edge
describe('I3: menu clamping', () => {
  it('clamps the menu inside the viewport', async () => {
    const { menuPosition } = await import('../src/ui/SelectionMenu')
    expect(menuPosition({ top: 0, left: 1500, width: 200, height: 30 }, 1440)).toEqual({
      top: 8,
      left: 1440 - 200 - 8,
    })
    expect(menuPosition({ top: 5, left: 100, width: 200, height: 30 }, 1440)).toEqual({
      top: 8,
      left: 100,
    })
    expect(menuPosition({ top: 900, left: 100, width: 200, height: 30 }, 1440)).toEqual({
      top: Math.max(8, Math.min(900 - 48, window.innerHeight - 30 - 48)),
      left: 100,
    })
  })
})

// I4: the error state keeps the actions visible (each action click = retry)
describe('I4: selection menu retry', () => {
  it('shows the actions alongside the error line', async () => {
    const { SelectionMenu } = await import('../src/ui/SelectionMenu')
    const { fireEvent } = await import('@testing-library/react')
    const { render, screen } = await import('@testing-library/react')
    render(<SelectionMenu rect={{ top: 10, left: 10 }} pending={false} error="http-429" onClose={() => {}} onRewrite={() => {}} />)
    expect(screen.getByRole('menuitem', { name: 'Polish' })).toBeTruthy()
    expect(screen.getByText('http-429')).toBeTruthy()
    void fireEvent
  })
})

// I6: dialogs close on Escape and are reachable by keyboard
describe('I6: dialog keyboard handling', () => {
  it('AiSettings closes on Escape', async () => {
    const mod = await import('../src/ui/AiSettings')
    const AiSettings = mod.default
    const { fireEvent } = await import('@testing-library/react')
    const { render } = await import('@testing-library/react')
    const closed = vi.fn()
    render(<AiSettings open onClose={closed} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(closed).toHaveBeenCalled()
  })
  it('BreakdownPanel closes on Escape', async () => {
    const modB = await import('../src/ui/BreakdownPanel')
    const BreakdownPanel = modB.default
    const { fireEvent } = await import('@testing-library/react')
    const { render } = await import('@testing-library/react')
    const { emptyDoc } = await import('../src/core/types')
    const closed = vi.fn()
    render(<BreakdownPanel open onClose={closed} doc={emptyDoc()} onOpenSettings={() => {}} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(closed).toHaveBeenCalled()
  })
})

// I7: prompt truncation is honest — block boundary + a note
describe('I7: prompt truncation on block boundaries', () => {
  it('cuts whole blocks and reports kept/total', async () => {
    const { buildBreakdownPrompt } = await import('../src/ai/breakdown')
    const { emptyDoc } = await import('../src/core/types')
    const filler = 'x'.repeat(500)
    const doc = {
      ...emptyDoc(),
      blocks: Array.from({ length: 80 }, (_, i) => ({
        type: 'action' as const,
        text: `${i} ${filler}`,
      })),
    }
    const { prompt, truncated } = buildBreakdownPrompt(doc)
    expect(truncated).toBeTruthy()
    expect(truncated!.kept).toBeLessThan(80)
    expect(truncated!.kept).toBeGreaterThan(0)
    expect(prompt).toContain(`truncated after ${truncated!.kept}`)
    const blocksInPrompt = (prompt.match(/Action:/g) ?? []).length
    expect(blocksInPrompt).toBe(truncated!.kept)
  })
  it('short scripts are not truncated', async () => {
    const { buildBreakdownPrompt } = await import('../src/ai/breakdown')
    const { emptyDoc } = await import('../src/core/types')
    const out = buildBreakdownPrompt(emptyDoc())
    expect(out.truncated).toBeNull()
  })
})

describe('I2: rewrite replaces the menued range, not the present selection', () => {
  it('accepts an explicit range', async () => {
    const { rewriteSelection } = await import('../src/ai/rewrite')
    const { createEditor } = await import('../src/editor/schema')
    const { emptyDoc } = await import('../src/core/types')
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'REPLACED' } }] }), { status: 200 }),
    ))
    vi.stubGlobal('localStorage', {
      getItem: () => JSON.stringify({ provider: 'ollama', endpoint: 'http://localhost:11434/v1', model: 'm' }),
      setItem: () => undefined,
      removeItem: () => undefined,
    })
    const editor = createEditor(emptyDoc())
    editor.commands.setContent({
      type: 'doc',
      content: [{ type: 'block', attrs: { elementType: 'action' }, content: [{ type: 'text', text: 'abcdefghij' }] }],
    })
    // menu was opened on "cde" (range 3..6); the live selection has since moved to the end
    editor.commands.setTextSelection(11)
    const ok = await rewriteSelection(editor, 'Shorten', { range: { from: 3, to: 6 } })
    expect(ok).toBe(true)
    expect(JSON.stringify(editor.getJSON())).toContain('abREPLACEDfghij')
    editor.destroy()
    vi.unstubAllGlobals()
  })
})
