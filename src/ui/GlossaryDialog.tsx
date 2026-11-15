import { useEffect, useState } from 'react'
import { searchGlossary } from '../glossary'
import { useLang, useT } from '../i18n'
import Dialog from './Dialog'

export default function GlossaryDialog(props: { open: boolean; onClose: () => void }) {
  const t = useT()
  const lang = useLang()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!props.open) return
    setQuery('')
  }, [props.open])

  if (!props.open) return null
  const entries = searchGlossary(query, lang)

  return (
    <Dialog label={t('glossary.title')} onClose={props.onClose} className="sf-ai-settings sf-glossary">
      <button type="button" className="sf-close" aria-label={t('glossary.close')} onClick={props.onClose}>×</button>
      <h2>{t('glossary.title')}</h2>
      <p className="sf-ai-note sf-glossary-sub">{t('glossary.subtitle')}</p>
      <input
        className="sf-glossary-search"
        type="search"
        aria-label={t('glossary.search')}
        placeholder={t('glossary.search')}
        value={query}
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
      />
      <dl className="sf-glossary-list">
        {entries.length === 0 && <p className="sf-ai-note">{t('glossary.none')}</p>}
        {entries.map((e) => (
          <div key={e.term.en} className="sf-glossary-entry">
            <dt>
              {e.term[lang]}
              {lang === 'fa' && <span className="sf-glossary-alt" lang="en" dir="ltr">{e.term.en}</span>}
            </dt>
            <dd>{e.definition[lang]}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  )
}
