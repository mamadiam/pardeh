import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../src/App'
import { emptyDoc } from '../src/core/types'
import { elementLabel, langFor, translate } from '../src/i18n'

afterEach(cleanup)

function renderApp() {
  const { container } = render(<App doc={emptyDoc()} />)
  return container.querySelector('.sf-app') as HTMLElement
}

describe('interface language follows writing direction', () => {
  it('maps rtl to Persian and ltr to English', () => {
    expect(langFor('rtl')).toBe('fa')
    expect(langFor('ltr')).toBe('en')
  })

  it('switches the whole interface to Persian and back to English', () => {
    const app = renderApp()
    expect(app.getAttribute('lang')).toBe('en')
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    expect(screen.getByText('Untitled screenplay')).toBeTruthy()

    const toFa = screen.getByRole('button', { name: /right-to-left \(Persian\)/ })
    expect(toFa.textContent).toBe('فارسی')
    fireEvent.click(toFa)
    expect(app.getAttribute('lang')).toBe('fa')
    expect(app.getAttribute('dir')).toBe('rtl')
    expect(screen.getByRole('button', { name: 'ذخیره' })).toBeTruthy()
    expect(screen.getByText('فیلم‌نامه‌ی بی‌نام')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'نوع عنصر' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()

    const toEn = screen.getByRole('button', { name: /چپ‌به‌راست/ })
    expect(toEn.textContent).toBe('English')
    fireEvent.click(toEn)
    expect(app.getAttribute('lang')).toBe('en')
    expect(app.getAttribute('dir')).toBe('ltr')
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
  })

  it('shows the empty-page hint in the interface language', () => {
    const app = renderApp()
    const hint = () => app.querySelector('[data-placeholder]')?.getAttribute('data-placeholder')
    expect(hint()).toMatch(/^Start writing/)
    fireEvent.click(screen.getByRole('button', { name: /right-to-left/ }))
    expect(hint()).toMatch(/^نوشتن را شروع کنید/)
  })
})

describe('translate', () => {
  it('fills placeholders and writes numbers in Persian digits for fa', () => {
    expect(translate('en', 'status.words', { n: 120 })).toBe('120 words')
    expect(translate('fa', 'status.words', { n: 120 })).toBe('۱۲۰ کلمه')
  })

  it('labels every element in both languages', () => {
    expect(elementLabel('en', 'scene')).toBe('Scene Heading')
    expect(elementLabel('fa', 'dialogue')).toBe('دیالوگ')
  })

  it('keeps ZWNJ in Persian strings', () => {
    expect(translate('fa', 'app.untitled')).toContain('‌')
  })
})
