import { describe, expect, it } from 'vitest'
import { draftOf, fileSummary, importStatus, parseTopicFile, withKeptDraft, type ImportTopic } from './import-file'
import { topicRole } from './store'

/** A small export in the Artifact's shape (Topic Studio/*.topic-studio.json). */
function exportFile(over: Record<string, unknown> = {}, project: Record<string, unknown> = {}) {
  return JSON.stringify({
    kind: 'topic-studio-writer', v: 1, exportedAt: 1793916944657,
    project: {
      id: 'pmw3q079b34j4', client: 'AAAF', topic: 'PP16/01/26 - How Do I Find God Again?', primary: 'how do i find god again',
      secondary: 'how to find god again\nhow to come back to god', monday: 'https://truenorth.monday.com/boards/1/pulses/2',
      terms: [{ t: 'find God', key: 'find god', tier: 'high' }, { t: 'grace', key: 'grace', tier: 'medium' }],
      questions: [{ q: 'How do I find God again?', heading: true }], draftHtml: '', shared: true, archived: false,
      updated: 1793916935846, importedAt: 1793990000000, ...project,
    },
    pages: [
      { id: 'c10l23gr', kind: 'competitor', url: 'https://exponential.org/x', title: 'The 5 Awakenings', captured: 1793894074895, blocks: [['h1', 'The 5 Awakenings']], links: [] },
      { id: 'd1', kind: 'discussion', url: 'https://reddit.com/r/x', title: 'Thread', blocks: [] },
    ],
    client: { code: 'AAAF', name: 'Ask An Adventist Friend', faith: true, about: 'A ministry' },
    feedback: { terms: {}, writer: {} }, features: { avoid: true },
    ...over,
  })
}

const parsed = (text = exportFile()) => {
  const f = parseTopicFile(text)
  if (typeof f === 'string') throw new Error(f)
  return f
}

describe('parseTopicFile', () => {
  it('reads an Artifact export into the columns and keeps the project whole', () => {
    const f = parsed()
    expect(f.artifact_id).toBe('pmw3q079b34j4')
    expect(f.client).toEqual({ code: 'AAAF', name: 'Ask An Adventist Friend', profile: { faith: true, about: 'A ministry' } })
    expect(f.topic).toBe('PP16/01/26 - How Do I Find God Again?')
    expect(f.primary_keyphrase).toBe('how do i find god again')
    expect(f.monday_url).toBe('https://truenorth.monday.com/boards/1/pulses/2')
    expect(f.shared).toBe(true)
    expect(f.artifact_updated_at).toBe(new Date(1793916935846).toISOString())
    expect(f.data.terms).toHaveLength(2)
    expect(f.data).not.toHaveProperty('importedAt')
    expect(f.data.exported).toMatchObject({ v: 1, features: { avoid: true } })
  })

  it('keeps every page, its id and capture time in columns and the rest in data', () => {
    const f = parsed()
    expect(f.pages).toHaveLength(2)
    expect(f.pages[0]).toMatchObject({ artifact_id: 'c10l23gr', kind: 'competitor', url: 'https://exponential.org/x', title: 'The 5 Awakenings', captured_at: new Date(1793894074895).toISOString() })
    expect(f.pages[0].data).toEqual({ blocks: [['h1', 'The 5 Awakenings']], links: [] })
    expect(f.pages[1].captured_at).toBeNull()
  })

  it('refuses anything that is not a topic export', () => {
    expect(parseTopicFile('not json')).toMatch(/not a Topic Studio topic file/)
    expect(parseTopicFile(JSON.stringify({ kind: 'other', project: {} }))).toMatch(/not a Topic Studio topic file/)
    expect(parseTopicFile(exportFile({}, { id: '../x' }))).toMatch(/not a Topic Studio topic file/)
    expect(parseTopicFile(exportFile({}, { topic: '  ' }))).toMatch(/no name/)
    expect(parseTopicFile(exportFile({ client: null }, { client: '' }))).toMatch(/which client/)
  })

  it('takes the client code from the project when the export has no client', () => {
    expect(parsed(exportFile({ client: null })).client).toEqual({ code: 'AAAF', name: 'AAAF', profile: {} })
  })

  it('drops a Monday link that is not a web address', () => {
    expect(parsed(exportFile({}, { monday: 'javascript:alert(1)' })).monday_url).toBeNull()
  })

  it('gives the same file the same hash, and a changed file another', () => {
    expect(parsed().content_hash).toBe(parsed().content_hash)
    // importedAt (a writer's offline copy) is not content.
    expect(parsed(exportFile({}, { importedAt: 1 })).content_hash).toBe(parsed().content_hash)
    expect(parsed(exportFile({}, { primary: 'find god again' })).content_hash).not.toBe(parsed().content_hash)
  })
})

describe('importStatus', () => {
  const f = parsed()
  const here = (o: Partial<{ content_hash: string; artifact_updated_at: string; draft: string }> = {}) => ({ content_hash: 'x', artifact_updated_at: f.artifact_updated_at, draft: '', ...o })
  it('new, same, updated and older', () => {
    expect(importStatus(f, null)).toBe('new')
    expect(importStatus(f, here({ content_hash: f.content_hash }))).toBe('same')
    expect(importStatus(f, here())).toBe('updated')
    expect(importStatus(f, here({ artifact_updated_at: '2030-01-01T00:00:00.000Z' }))).toBe('older')
  })
})

describe('withKeptDraft', () => {
  const f = parsed()
  it('keeps the draft here when the file has none, as the Artifact does', () => {
    expect(draftOf(withKeptDraft(f, { content_hash: null, artifact_updated_at: null, draft: '<p>Mine</p>' }).data)).toBe('<p>Mine</p>')
  })
  it("uses the file's draft when it has one", () => {
    const g: ImportTopic = { ...f, data: { ...f.data, draftHtml: '<p>New</p>' } }
    expect(draftOf(withKeptDraft(g, { content_hash: null, artifact_updated_at: null, draft: '<p>Mine</p>' }).data)).toBe('<p>New</p>')
  })
})

describe('fileSummary', () => {
  it('counts terms, competitor pages and draft words', () => {
    expect(fileSummary(parsed())).toBe('2 terms, 1 competitor page')
    expect(fileSummary(parsed(exportFile({}, { draftHtml: '<h1>One two</h1><p>three</p>' })))).toBe('2 terms, 1 competitor page, a draft of 3 words')
  })
})

describe('topicRole', () => {
  it('is SEO with the research grant, writer with the workshop grant, else nothing', () => {
    expect(topicRole(k => k === 'topic-studio-seo')).toBe('seo')
    expect(topicRole(k => k === 'topic-studio' || k === 'topic-studio-seo')).toBe('seo')
    expect(topicRole(k => k === 'topic-studio')).toBe('writer')
    expect(topicRole(() => false)).toBeNull()
  })
})

describe('what an import may bring in (security audit, 8 November 2026)', () => {
  it('cleans the draft the way the editor\'s saves are cleaned', () => {
    const f = parsed(exportFile({}, { draftHtml: '<h1>Title</h1><p onclick="x()">Hi<script>alert(1)</script></p><img src=x onerror=y>' }))
    const html = String(f.data.draftHtml)
    expect(html).toContain('<h1>Title</h1>')
    expect(html).not.toMatch(/script|onclick|onerror|<img/i)
  })
  it('keeps only web addresses for the captured pages', () => {
    const f = parsed(exportFile({ pages: [{ id: 'a', kind: 'competitor', url: 'javascript:alert(1)', title: 'x', blocks: [] }, { id: 'b', kind: 'competitor', url: 'https://ok.example/x', title: 'y', blocks: [] }] }))
    expect(f.pages.map(p => p.url)).toEqual(['', 'https://ok.example/x'])
  })
})
