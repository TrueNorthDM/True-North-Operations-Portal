import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HreflangCodeBlock, missingLanguages } from './HreflangCodeBlock'

// The code waits for every current language (audit, 10 October 2026).

const EN = { language_code: 'en', url: 'https://www.example.com/a' }
const PT = { language_code: 'pt', url: 'https://www.example.com/pt/a' }

describe('HreflangCodeBlock', () => {
  it('names the languages still missing instead of offering the code', () => {
    render(<HreflangCodeBlock urls={[EN, PT]} languages={['en', 'pt', 'es', 'sw']} />)
    expect(screen.getByText('Add the Spanish and Swahili links to get the code.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull()
  })

  it('offers the code once every current language has a link', () => {
    render(<HreflangCodeBlock urls={[EN, PT]} languages={['en', 'pt']} />)
    expect(screen.getByRole('button', { name: /copy code/i })).toBeInTheDocument()
    expect(screen.getByText(/hreflang="pt"/)).toBeInTheDocument()
  })

  it('counts an empty link as missing', () => {
    expect(missingLanguages([EN, { language_code: 'pt', url: ' ' }], ['en', 'pt'])).toEqual(['pt'])
  })
})
