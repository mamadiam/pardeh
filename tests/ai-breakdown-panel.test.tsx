import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

const goodJson = JSON.stringify({
  logline: 'A night visit goes wrong.',
  characters: [{ name: 'SARA', description: 'the visitor' }],
  locations: ['House'],
  scenes: [{ title: 'INT. HOUSE - NIGHT', summary: 'Lights flicker.' }],
})

function okFetch(): typeof fetch {
  return vi.fn(async (_url: string, init: RequestInit) => {
    void JSON.parse(init.body as string) // record the compiled count
    return new Response(JSON.stringify({ choices: [{ message: { content: goodJson } }] }), { status: 200 })
  }) as unknown as typeof fetch
}

import BreakdownPanel from '../src/ui/BreakdownPanel'

describe('BreakdownPanel', () => {
  it('shows the no-provider state with a settings link', () => {
    render(<BreakdownPanel open onClose={() => {}} doc={emptyDoc()} onOpenSettings={() => {}} />)
    expect(screen.getByText(/no provider configured/i)).toBeTruthy()
  })

  it('runs, then renders logline, characters, locations and scenes', async () => {
    store.set('sf-ai', JSON.stringify({ provider: 'ollama', endpoint: 'http://localhost:11434/v1', model: 'm' }))
    vi.stubGlobal('fetch', okFetch())
    render(<BreakdownPanel open onClose={() => {}} doc={emptyDoc()} onOpenSettings={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /run breakdown/i }))
    await waitFor(() => expect(screen.getByText('A night visit goes wrong.')).toBeTruthy())
    expect(screen.getByText('SARA')).toBeTruthy()
    expect(screen.getByText('House')).toBeTruthy()
    expect(screen.getByText('INT. HOUSE - NIGHT')).toBeTruthy()
  })

  it('shows an inline error with retry when the provider fails', async () => {
    store.set('sf-ai', JSON.stringify({ provider: 'ollama', endpoint: 'http://localhost:11434/v1', model: 'm' }))
    vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 500 })))
    render(<BreakdownPanel open onClose={() => {}} doc={emptyDoc()} onOpenSettings={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /run breakdown/i }))
    await waitFor(() => expect(screen.getByText(/http-500/)).toBeTruthy())
    // retry affordance exists and re-runs (still failing: error stays)
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    await waitFor(() => expect(screen.getByText(/http-500/)).toBeTruthy(), { timeout: 3000 })
  })

  it('shows a timeout-ish error for bad json output', async () => {
    store.set('sf-ai', JSON.stringify({ provider: 'ollama', endpoint: 'http://localhost:11434/v1', model: 'm' }))
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'no json here' } }] }), { status: 200 }),
    ))
    render(<BreakdownPanel open onClose={() => {}} doc={emptyDoc()} onOpenSettings={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /run breakdown/i }))
    await waitFor(() => expect(screen.getByText(/bad-json/)).toBeTruthy())
  })
})
