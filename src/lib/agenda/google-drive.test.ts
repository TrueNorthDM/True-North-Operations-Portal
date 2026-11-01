import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => { throw new Error('no database in these tests') } }))
vi.mock('./google-app', () => ({ accessTokenFor: async () => 'tok' }))

import { DriveError, ensurePath, quoted, updateFile, uploadFile, writeFile } from './google-drive'

describe('names in a Drive search', () => {
  it('keep quotes and backslashes from breaking the query', () => {
    expect(quoted("Ana O'Neil")).toBe("'Ana O\\'Neil'")
    expect(quoted('a\\b')).toBe("'a\\\\b'")
  })
})

type Call = { url: string; method: string; body?: unknown }
/** A fake Drive: answers by the order of the calls, and keeps what was asked. */
function fakeDrive(answers: { status?: number; json: unknown }[]) {
  const calls: Call[] = []
  const fn = vi.fn(async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body })
    const a = answers.shift() ?? { status: 500, json: { error: { message: 'unexpected call' } } }
    return new Response(JSON.stringify(a.json), { status: a.status ?? 200, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fn)
  return calls
}
afterEach(() => { vi.unstubAllGlobals() })

const FILE = { name: 'INV-2026-010-Ana Lima.pdf', mime: 'application/pdf', bytes: new Uint8Array([37, 80, 68, 70]) }

describe('a nested folder path', () => {
  it('finds or makes each folder once, and keeps the ids for the rest of the run', async () => {
    const calls = fakeDrive([
      { json: { files: [{ id: 'docs' }] } },
      { json: { files: [] } }, { json: { id: 'inv' } },
    ])
    const cache = new Map<string, string>()
    expect(await ensurePath('t', 'root', ['Docs from the Portal', 'Invoices'], cache)).toBe('inv')
    expect(calls.map(c => c.method)).toEqual(['GET', 'GET', 'POST'])
    expect(new URL(calls[0].url).searchParams.get('q')).toContain("name = 'Docs from the Portal' and 'root' in parents")
    // The second time, nothing is asked.
    expect(await ensurePath('t', 'root', ['Docs from the Portal', 'Invoices'], cache)).toBe('inv')
    expect(calls).toHaveLength(3)
  })
})

describe('writing a file', () => {
  it('uploads a new file into its folder', async () => {
    const calls = fakeDrive([{ json: { id: 'f1', webViewLink: 'https://drive.google.com/file/d/f1/view' } }])
    expect(await uploadFile('t', 'inv', FILE)).toEqual({ id: 'f1', link: 'https://drive.google.com/file/d/f1/view' })
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toContain('/upload/drive/v3/files?uploadType=multipart')
  })

  it('writes a new version over the stored file: the same id', async () => {
    const calls = fakeDrive([{ json: { id: 'f1' } }])
    const done = await writeFile('t', 'inv', FILE, 'f1')
    expect(done).toEqual({ id: 'f1', link: 'https://drive.google.com/file/d/f1/view', fresh: false })
    expect(calls[0].method).toBe('PATCH')
    expect(calls[0].url).toContain('/upload/drive/v3/files/f1?uploadType=multipart')
    const text = await (calls[0].body as Blob).text()
    expect(text).toContain('"trashed":false')
  })

  it('writes it again as new when the stored file is gone', async () => {
    const calls = fakeDrive([
      { status: 404, json: { error: { message: 'File not found: f1.' } } },
      { json: { files: [] } },
      { json: { id: 'f2' } },
    ])
    const done = await writeFile('t', 'inv', FILE, 'f1')
    expect(done).toMatchObject({ id: 'f2', fresh: true })
    expect(calls.map(c => c.method)).toEqual(['PATCH', 'GET', 'POST'])
  })

  it('writes over a file of the same name when no id was kept', async () => {
    const calls = fakeDrive([{ json: { files: [{ id: 'old' }] } }, { json: { id: 'old' } }])
    expect(await writeFile('t', 'inv', FILE)).toMatchObject({ id: 'old', fresh: false })
    expect(calls.map(c => c.method)).toEqual(['GET', 'PATCH'])
  })

  it('does not take any other refusal for a missing file', async () => {
    fakeDrive([{ status: 403, json: { error: { message: 'Rate limit exceeded' } } }])
    await expect(updateFile('t', 'f1', FILE)).rejects.toBeInstanceOf(DriveError)
    fakeDrive([{ status: 403, json: { error: { message: 'Rate limit exceeded' } } }])
    await expect(writeFile('t', 'inv', FILE, 'f1')).rejects.toThrow('Drive answered 403: Rate limit exceeded')
  })
})
