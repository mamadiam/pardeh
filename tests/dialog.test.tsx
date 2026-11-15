import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import Dialog from '../src/ui/Dialog'

afterEach(cleanup)

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>open</button>
      {open && (
        <Dialog label="Test dialog" onClose={() => setOpen(false)}>
          <button type="button">one</button>
          <button type="button">two</button>
        </Dialog>
      )}
    </>
  )
}

describe('Dialog', () => {
  it('moves focus into the panel when it opens', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    expect(screen.getByRole('dialog', { name: 'Test dialog' })).toBeTruthy()
    expect(document.activeElement?.textContent).toBe('one')
  })

  it('closes on Escape and returns focus to the trigger', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement?.textContent).toBe('open')
  })

  it('keeps Tab inside the panel', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    screen.getByRole('button', { name: 'two' }).focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement?.textContent).toBe('one')
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement?.textContent).toBe('two')
  })
})
