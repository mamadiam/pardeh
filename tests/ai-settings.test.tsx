import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadAiConfig } from '../src/ai/config'


vi.mock('../src/ai/client', () => ({
  AiError: class AiError extends Error {},
  listModels: vi.fn(async () => ['llama3.1', 'qwen2.5:7b']),
  chat: vi.fn(),
}))

import AiSettings from '../src/ui/AiSettings'

let store: Map<string, string>
beforeEach(() => {
  store = new Map<string, string>()
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

describe('AiSettings dialog', () => {
  it('renders nothing while closed', () => {
    const { container } = render(<AiSettings open={false} onClose={() => {}} />)
    expect(container.querySelector('.sf-ai-settings')).toBeNull()
  })

  it('hides the key field for local providers and shows it for OpenAI', () => {
    render(<AiSettings open onClose={() => {}} />)
    expect(screen.queryByLabelText(/api key/i)).toBeNull()
    fireEvent.change(screen.getByLabelText(/provider/i), { target: { value: 'openai' } })
    expect(screen.getByLabelText(/api key/i)).toBeTruthy()
  })

  it('prefills the endpoint when the provider switches', () => {
    render(<AiSettings open onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/provider/i), { target: { value: 'lmstudio' } })
    const endpoint = screen.getByLabelText(/endpoint/i) as HTMLInputElement
    expect(endpoint.value).toBe('http://localhost:1234/v1')
  })

  it('saves the config and closes', async () => {
    const saved = vi.fn()
    render(<AiSettings open onClose={saved} />)
    fireEvent.change(screen.getByLabelText(/provider/i), { target: { value: 'openai' } })
    fireEvent.change(screen.getByLabelText(/model/i), { target: { value: 'gpt-4o-mini' } })
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: 'sk-abc' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(loadAiConfig()).toMatchObject({ provider: 'openai', model: 'gpt-4o-mini', apiKey: 'sk-abc' })
    expect(saved).toHaveBeenCalled()
  })

  it('loads models from the provider for the select', async () => {
    render(<AiSettings open onClose={() => {}} />)
    await waitFor(() => {
      const options = screen.getAllByRole('option').map((o: Element) => (o as HTMLOptionElement).value)
      expect(options).toContain('llama3.1')
    })
  })

  it('connection test reports success in a positive pill', async () => {
    const fetchStub = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchStub)
    render(<AiSettings open onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }))
    await waitFor(() => expect(screen.getByText('Works')).toBeTruthy())
  })

  it('shows the key link and the no-server note for a cloud provider', () => {
    render(<AiSettings open onClose={() => {}} />)
    expect(screen.queryByRole('link', { name: /get a key/i })).toBeNull()
    fireEvent.change(screen.getByLabelText(/provider/i), { target: { value: 'mistral' } })
    const link = screen.getByRole('link', { name: /get a key/i }) as HTMLAnchorElement
    expect(link.href).toBe('https://console.mistral.ai/api-keys')
    expect(screen.getByText(/your key stays in this browser/i)).toBeTruthy()
  })

  it('warns when a provider may block browser calls', () => {
    render(<AiSettings open onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/provider/i), { target: { value: 'deepseek' } })
    expect(screen.getByText(/may block calls from a web page/i)).toBeTruthy()
  })

  it('does not show one provider\'s key under another', () => {
    render(<AiSettings open onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText(/provider/i), { target: { value: 'openai' } })
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: 'sk-openai' } })
    fireEvent.change(screen.getByLabelText(/provider/i), { target: { value: 'xai' } })
    expect((screen.getByLabelText(/api key/i) as HTMLInputElement).value).toBe('')
    fireEvent.change(screen.getByLabelText(/provider/i), { target: { value: 'openai' } })
    expect((screen.getByLabelText(/api key/i) as HTMLInputElement).value).toBe('sk-openai')
  })
})
