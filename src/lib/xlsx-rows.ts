/**
 * Reads the rows of the first sheet of an Excel file (.xlsx), as text, with
 * nothing but what the browser and Node already have. An .xlsx is a zip of
 * XML files: this finds the sheet and the shared strings in the zip, inflates
 * them (DecompressionStream) and reads the cells.
 *
 * Small on purpose: enough for a report exported by a payroll system (text
 * and numbers in a grid), not for formulas, dates or styles. It runs in the
 * browser, so the file itself never has to be sent to the server.
 */

const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8)
const u32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw')
  const writer = ds.writable.getWriter()
  // Written without waiting: the reader below is what drains it.
  void writer.write(data as BufferSource).then(() => writer.close()).catch(() => {})
  const parts: Uint8Array[] = []
  const reader = ds.readable.getReader()
  for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value as Uint8Array) }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) { out.set(p, at); at += p.length }
  return out
}

/** The files in a zip, by name, read from its central directory. */
export async function unzip(bytes: Uint8Array, want: (name: string) => boolean): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  let end = -1
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 66_000; i--) if (u32(bytes, i) === 0x06054b50) { end = i; break }
  if (end < 0) throw new Error('This is not an Excel file (.xlsx).')
  const count = u16(bytes, end + 10)
  let at = u32(bytes, end + 16)
  const text = new TextDecoder()
  for (let n = 0; n < count && u32(bytes, at) === 0x02014b50; n++) {
    const method = u16(bytes, at + 10), size = u32(bytes, at + 20)
    const nameLen = u16(bytes, at + 28), extraLen = u16(bytes, at + 30), commentLen = u16(bytes, at + 32), local = u32(bytes, at + 42)
    const name = text.decode(bytes.subarray(at + 46, at + 46 + nameLen))
    at += 46 + nameLen + extraLen + commentLen
    if (!want(name)) continue
    const start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28)
    const raw = bytes.subarray(start, start + size)
    if (method !== 0 && method !== 8) throw new Error('This Excel file is packed in a way the portal cannot read.')
    out.set(name, text.decode(method === 8 ? await inflate(raw) : raw))
  }
  return out
}

const unescape = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&')
const texts = (xml: string) => unescape([...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]).join(''))
/** "C" is 2, "AA" is 26: the column a cell sits in. */
const column = (ref: string) => { let n = 0; for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1 }

/** The sheet's rows, each a list of cell texts, empty cells as ''. */
export function sheetRows(sheetXml: string, sharedXml: string | undefined): string[][] {
  const shared = sharedXml ? [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => texts(m[1])) : []
  return [...sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(row => {
    const cells: string[] = []
    let next = 0
    for (const c of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1], body = c[2] ?? ''
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1]
      const col = ref ? column(ref) : next
      const type = /\bt="(\w+)"/.exec(attrs)?.[1]
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
      const value = type === 's' && v != null ? shared[Number(v)] ?? '' : v != null ? unescape(v) : texts(body)
      while (cells.length < col) cells.push('')
      cells[col] = value
      next = col + 1
    }
    return cells
  })
}

/** The first sheet's rows of an .xlsx file. */
export async function xlsxRows(bytes: Uint8Array): Promise<string[][]> {
  const files = await unzip(bytes, name => name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
  const sheet = [...files.keys()].filter(n => n.startsWith('xl/worksheets/')).sort((a, b) => a.length - b.length || a.localeCompare(b))[0]
  if (!sheet) throw new Error('This Excel file has no sheet to read.')
  return sheetRows(files.get(sheet)!, files.get('xl/sharedStrings.xml'))
}

/** The rows of a CSV text: commas, quotes doubled inside quotes, any line ending. */
export function csvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some(c => c.trim())) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell)
  if (row.some(c => c.trim())) rows.push(row)
  return rows
}
