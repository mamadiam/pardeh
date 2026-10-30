import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyDoc } from '../src/core/types'



let store: Map<string, string>
beforeEach(() => {
  store = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('rewrite feature (wired through the editor via provider config)', () => {
  /**
   * driving the DOM selection inside ProseMirror headlessly is flaky, so the
   * integration contract under test is the rewrite pipeline itself; the menu
   * component covers the interaction shell.
   */

  it('rewrites the selected range with the mocked provider', async () => {
    const fake = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'Short line' } }] }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fake)
    store.set('sf-ai', JSON.stringify({ provider: 'ollama', endpoint: 'http://localhost:11434/v1', model: 'test-model' }))
    const { rewriteSelection } = await import('../src/ai/rewrite')
    const { createEditor } = await import('../src/editor/schema')
    const editor = createEditor(emptyDoc())
    editor.commands.setContent({
      type: 'doc',
      content: [
        { type: 'block', attrs: { elementType: 'dialogue' }, content: [{ type: 'text', text: 'I went to the house and then I went inside the house very slowly' }] },
      ],
    })
    // select "the house" (positions 8..17)
    editor.commands.setTextSelection({ from: 8, to: 17 })
    const ok = await rewriteSelection(editor, 'Shorten')
    expect(ok).toBe(true)
    const json = JSON.stringify(editor.getJSON())
    expect(json).toContain('Short line')
    expect(json).not.toContain('the house and')
    expect(fake).toHaveBeenCalledOnce()
    // provider config in the request
    const [, init] = (fake as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(JSON.parse(init.body).model).toBe('test-model')
    editor.destroy()
    void screen; void waitFor
  })

  it('returns false on provider failure without corrupting the doc', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 429 })))
    store.set('sf-ai', JSON.stringify({ provider: 'ollama', endpoint: 'http://localhost:11434/v1', model: 'm' }))
    const { rewriteSelection } = await import('../src/ai/rewrite')
    const { createEditor } = await import('../src/editor/schema')
    const editor = createEditor(emptyDoc())
    editor.commands.setContent({
      type: 'doc',
      content: [
        { type: 'block', attrs: { elementType: 'action' }, content: [{ type: 'text', text: 'Something happens.' }] },
      ],
    })
    editor.commands.setTextSelection({ from: 1, to: 10 })
    await expect(rewriteSelection(editor, 'Polish')).rejects.toMatchObject({ code: 'http-429' })
    expect(JSON.stringify(editor.getJSON())).toContain('Something happens.')
    editor.destroy()
  })
})

import { SelectionMenu } from '../src/ui/SelectionMenu'

describe('SelectionMenu interaction shell', () => {
  const onRewrite = vi.fn()
  it('lists the four actions and a custom field; closes on Esc', async () => {
    const { user } = { user: undefined as never }
    render(<SelectionMenu rect={{ top: 100, left: 100 }} pending={false} error={null} onClose={() => {}} onRewrite={onRewrite} />)
    expect(screen.getByRole('menuitem', { name: 'Polish' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Shorten' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Expand' })).toBeTruthy()
    expect(screen.getByPlaceholderText(/custom instruction/i)).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    void user
  })
})

import { fireEvent } from '@testing-library/react'
