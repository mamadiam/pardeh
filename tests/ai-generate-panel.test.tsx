import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

beforeEach(() => {
  vi.resetModules()
  localStorage.setItem('sf-ai', JSON.stringify({ provider: 'opencode', endpoint: 'http://x', model: 'm', apiKey: 'k' }))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const PACKAGE = JSON.stringify({
  title: 'The Tide',
  logline: 'A keeper discovers the sea keeps secrets.',
  genre: 'Mystery',
  characters: [{ name: 'AL', description: 'keeper' }],
  scenes: [{ heading: 'INT. LIGHTHOUSE - NIGHT', blocks: [{ type: 'action', text: 'Wind hammers.' }] }],
})

describe('GeneratePanel', () => {
  it('creates a project doc from the idea via the model', async () => {
    const chat = vi.fn(async (_cfg?: unknown, _msgs?: unknown[]) => '```json\n' + PACKAGE + '\n```')
    vi.doMock('../src/ai/client', () => ({ chat, AiError: class extends Error {} }))
    const { default: Generate } = await import('../src/ui/GeneratePanel')
    const created: string[] = []
    render(<Generate open onClose={() => {}} doc={undefined as never} onCreated={(d) => created.push(d.meta.title)} onAppend={() => {}} />)
    fireEvent.change(screen.getByLabelText('idea'), { target: { value: 'a lighthouse keeper' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open as new project' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Open as new project' }))
    expect(created).toEqual(['The Tide'])
    const sent = (chat.mock.calls[0]?.[1] as { content: string }[] | undefined)?.[1]?.content ?? ''
    expect(sent).toContain('a lighthouse keeper')
  })

  it('shows model errors inline and keeps the form', async () => {
    const chat = vi.fn(async () => {
      throw Object.assign(new Error('http-429: too many requests'), { name: 'AiError' })
    })
    vi.doMock('../src/ai/client', () => ({ chat, AiError: class extends Error { code: string; constructor(m: string) { super(m); this.code = '' } } }))
    const { default: Generate } = await import('../src/ui/GeneratePanel')
    render(<Generate open onClose={() => {}} doc={undefined as never} onCreated={() => {}} onAppend={() => {}} />)
    fireEvent.change(screen.getByLabelText('idea'), { target: { value: 'idea' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    await waitFor(() => expect(screen.getByText(/http-429/)).toBeTruthy())
    expect(screen.getByLabelText('idea')).toBeTruthy()
  })

  it('continue mode appends scenes to the open script', async () => {
    const chat = vi.fn(async (_cfg?: unknown, _msgs?: unknown[]) => PACKAGE)
    vi.doMock('../src/ai/client', () => ({ chat, AiError: class extends Error {} }))
    const { default: Generate } = await import('../src/ui/GeneratePanel')
    const { emptyDoc } = await import('../src/core/types')
    const appended: number[] = []
    render(
      <Generate
        open
        onClose={() => {}}
        doc={{ ...emptyDoc(), blocks: [{ type: 'scene', text: 'INT. HOUSE - NIGHT' }] }}
        onCreated={() => {}}
        onAppend={(blocks) => appended.push(blocks.length)}
      />,
    )
    fireEvent.click(screen.getByLabelText('continue current screenplay'))
    fireEvent.change(screen.getByLabelText('idea'), { target: { value: 'more storms' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Append chapter' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Append chapter' }))
    expect(appended).toEqual([2])
    const sent = (chat.mock.calls[0]?.[1] as { content: string }[] | undefined)?.[1]?.content ?? ''
    expect(sent).toContain('INT. HOUSE - NIGHT')
  })
})
