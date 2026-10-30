import { useEffect, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

// default export: FloatingMenu — a fixed menu at (x, y) with items
// (name: shared by the project dropdown and the title context menu)

describe('FloatingMenu', () => {
  it('renders items and closes after a click', async () => {
    const { FloatingMenu } = await import('../src/ui/FloatingMenu')
    const { fireEvent, render, screen } = await import('@testing-library/react')
    const picks: string[] = []
    const Harness = () => {
      const [items] = useState([
        { label: 'Rename', onSelect: () => picks.push('rename') },
        { label: 'Export', onSelect: () => picks.push('export') },
      ])
      useEffect(() => {
        void items
      }, [])
      return (
        <FloatingMenu
          x={10}
          y={20}
          items={items}
          onClose={() => picks.push('closed')}
        />
      )
    }
    render(<Harness />)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    expect(picks).toEqual(['rename', 'closed'])
  })

  it('closes on outside click and on Escape', async () => {
    const { FloatingMenu } = await import('../src/ui/FloatingMenu')
    const { fireEvent, render, screen } = await import('@testing-library/react')
    const onClose = vi.fn()
    render(
      <FloatingMenu
        x={0}
        y={0}
        items={[{ label: 'Do', onSelect: () => {} }]}
        onClose={onClose}
      />,
    )
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
    void screen
  })
})
