/**
 * The names of the portal's documents as files (owner, 31 October 2026): the
 * code, a hyphen, the person's full name from the Directory, the extension.
 * "INV-2026-010-Arnaldo Oliveira.pdf", "RMB-2026-002-Arnaldo Oliveira.pdf",
 * "RCT-2026-005-Arnaldo Oliveira.jpg" (a receipt keeps its own file's
 * extension). The same name is used in Google Drive and when anyone downloads
 * the file from the portal. Pure.
 */

/** Characters no file system takes in a name, and control characters. */
const BAD = /[\\/:*?"<>|\u0000-\u001f\u007f]/g

/** A person's name as it can sit in a file name: no slashes or colons, one space between words. */
export function namePart(s: string): string {
  return s.replace(BAD, ' ').replace(/\s+/g, ' ').trim()
}

/** "jpg" from "IMG_2041.JPG" or a storage path; "" when there is none. */
export function extOf(name: string | null | undefined): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(String(name ?? '').trim())
  return m ? m[1].toLowerCase() : ''
}

/** "INV-2026-010", "Arnaldo Oliveira", "pdf" -> "INV-2026-010-Arnaldo Oliveira.pdf". A missing name leaves the code alone. */
export function docFileName(code: string, fullName: string | null | undefined, ext: string): string {
  const who = namePart(fullName ?? '')
  const base = namePart(code) || 'document'
  const e = ext.replace(/^\./, '').toLowerCase()
  return `${who ? `${base}-${who}` : base}${e ? `.${e}` : ''}`
}

/**
 * The name for an HTTP header's plain filename="...": headers are Latin-1, so
 * accents are taken off ("Jose" for "José") and anything else outside plain
 * ASCII, and the quote and backslash, become a hyphen.
 */
export function asciiFallback(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '-').replace(/["\\]/g, '-')
}

/** The Content-Disposition header with both forms, as the i7 PDF route sends it. */
export function contentDisposition(name: string, how: 'attachment' | 'inline' = 'attachment'): string {
  return `${how}; filename="${asciiFallback(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

/** The file name a Content-Disposition header gives (the UTF-8 form first), or null. */
export function nameFromDisposition(header: string | null | undefined): string | null {
  if (!header) return null
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (star) {
    try { return decodeURIComponent(star[1].trim()) } catch { /* the plain form below */ }
  }
  const plain = /filename="([^"]*)"/i.exec(header)
  return plain ? plain[1] : null
}

/** The type Drive is told for a receipt, by its extension. */
export function mimeOfExt(ext: string): string {
  const e = ext.toLowerCase()
  return e === 'pdf' ? 'application/pdf'
    : e === 'jpg' || e === 'jpeg' ? 'image/jpeg'
      : e === 'png' ? 'image/png'
        : e === 'webp' ? 'image/webp'
          : e === 'heic' ? 'image/heic'
            : e === 'heif' ? 'image/heif'
              : 'application/octet-stream'
}
