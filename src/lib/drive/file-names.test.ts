import { describe, expect, it } from 'vitest'
import { asciiFallback, contentDisposition, docFileName, extOf, mimeOfExt, nameFromDisposition, namePart } from './file-names'

describe('document file names', () => {
  it('are the code, a hyphen, the full name and the extension', () => {
    expect(docFileName('INV-2026-010', 'Arnaldo Oliveira', 'pdf')).toBe('INV-2026-010-Arnaldo Oliveira.pdf')
    expect(docFileName('RMB-2026-002', 'Arnaldo Oliveira', 'pdf')).toBe('RMB-2026-002-Arnaldo Oliveira.pdf')
    expect(docFileName('RCT-2026-005', 'Arnaldo Oliveira', 'JPG')).toBe('RCT-2026-005-Arnaldo Oliveira.jpg')
  })

  it('keep accents, drop what no file system takes, and work without a name', () => {
    expect(docFileName('RCT-2026-005', '  José  da/Silva ', 'png')).toBe('RCT-2026-005-José da Silva.png')
    expect(namePart('A: "B" <C>')).toBe('A B C')
    expect(docFileName('INV-2026-001', null, 'pdf')).toBe('INV-2026-001.pdf')
  })

  it('take a receipt\'s extension from its own file', () => {
    expect(extOf('IMG_2041.JPG')).toBe('jpg')
    expect(extOf('person/uuid.heic')).toBe('heic')
    expect(extOf('no-extension')).toBe('')
    expect(extOf(null)).toBe('')
    expect(mimeOfExt('jpg')).toBe('image/jpeg')
    expect(mimeOfExt('pdf')).toBe('application/pdf')
  })
})

describe('the download header', () => {
  it('has a plain ASCII name and the UTF-8 one', () => {
    expect(asciiFallback('RCT-2026-005-José Núñez.jpg')).toBe('RCT-2026-005-Jose Nunez.jpg')
    expect(asciiFallback('a"b\\c✓.pdf')).toBe('a-b-c-.pdf')
    expect(contentDisposition('INV-2026-010-José Lima.pdf')).toBe(`attachment; filename="INV-2026-010-Jose Lima.pdf"; filename*=UTF-8''INV-2026-010-Jos%C3%A9%20Lima.pdf`)
    expect(contentDisposition('x.jpg', 'inline').startsWith('inline; ')).toBe(true)
  })

  it('is read back by the download, the UTF-8 name first', () => {
    expect(nameFromDisposition(contentDisposition('INV-2026-010-José Lima.pdf'))).toBe('INV-2026-010-José Lima.pdf')
    expect(nameFromDisposition('attachment; filename="plain.pdf"')).toBe('plain.pdf')
    expect(nameFromDisposition(null)).toBeNull()
  })
})
