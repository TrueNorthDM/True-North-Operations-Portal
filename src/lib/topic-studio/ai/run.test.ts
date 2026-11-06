import { describe, expect, it } from 'vitest'
import { ClaudeError, type ClaudeClient } from './claude'
import type { AiContext } from './features'
import { runFeature, type RunDeps } from './run'
import { DEFAULT_SETTINGS, readSettings } from './settings'
import { analysis, PAGES, project } from '../test-fixture'

const TERMS = [{ t: 'moisture meter', tier: 'high' }, { t: 'creosote', tier: 'low' }]
const ctx = (settings = DEFAULT_SETTINGS): AiContext => ({
  analysis: analysis(project({ terms: TERMS }), PAGES), pages: PAGES, settings, draftHtml: '',
  client: { code: 'BM', name: 'Bessemeter', heading: 'BM', faith: false, about: '', orig: '' },
})
const GOOD = '```json\n{"groups":[{"name":"Measuring","terms":["moisture meter","creosote"]}]}\n```'

function deps(over: Partial<RunDeps> & { text?: string; err?: Error } = {}) {
  const calls: { saved: unknown[]; logs: { ok: boolean; error: string; model: string }[]; requests: unknown[] } = { saved: [], logs: [], requests: [] }
  const client: ClaudeClient = {
    async complete(req) {
      calls.requests.push(req)
      if (over.err) throw over.err
      return { text: over.text ?? GOOD, model: 'claude-opus-5-5', inputTokens: 10, outputTokens: 5, ms: 20 }
    },
  }
  const d: RunDeps = {
    client, usedToday: async () => 0, lastRun: async () => null, now: () => 1_000_000,
    log: async r => { calls.logs.push(r) }, save: async p => { calls.saved.push(p) }, ...over,
  }
  return { d, calls }
}

describe('runFeature', () => {
  it('asks Claude with the feature\'s model and effort, saves what it read and logs the run', async () => {
    const { d, calls } = deps()
    const r = await runFeature('group', ctx(), { exempt: false }, d)
    expect(r).toEqual({ ok: true, model: 'claude-opus-5-5' })
    expect(calls.requests[0]).toMatchObject({ model: 'claude-opus-5-5', effort: 'medium' })
    expect((calls.requests[0] as { system: string }).system).toMatch(/em dash/)
    expect(calls.saved).toHaveLength(1)
    expect(calls.logs).toEqual([expect.objectContaining({ ok: true, inputTokens: 10, outputTokens: 5 })])
  })
  it('refuses a switched-off feature and a blocked model before calling Claude', async () => {
    const off = readSettings({ ai: { features: { group: { on: false } } } })
    const a = deps(); expect(await runFeature('group', ctx(off), { exempt: false }, a.d)).toMatchObject({ ok: false, error: expect.stringMatching(/switched off/) }); expect(a.calls.requests).toHaveLength(0)
    const blocked = readSettings({ ai: { features: { group: { on: true, model: 'claude-fable-5-1' } } } })
    const b = deps(); expect(await runFeature('group', ctx(blocked), { exempt: false }, b.d)).toMatchObject({ ok: false, error: expect.stringMatching(/not allowed/) }); expect(b.calls.requests).toHaveLength(0)
  })
  it('says what is missing without calling or logging', async () => {
    const { d, calls } = deps()
    const empty: AiContext = { ...ctx(), analysis: analysis(project(), PAGES) }
    expect(await runFeature('group', empty, { exempt: false }, d)).toMatchObject({ ok: false, error: expect.stringMatching(/term list first/) })
    expect(calls.requests).toHaveLength(0); expect(calls.logs).toHaveLength(0)
  })
  it('holds a person to the cooldown and the daily number, but not an exempt one', async () => {
    const cool = deps({ lastRun: async () => 1_000_000 - 5_000 })
    expect(await runFeature('group', ctx(), { exempt: false }, cool.d)).toMatchObject({ ok: false, error: expect.stringMatching(/Wait a few seconds.*10s/) })
    const full = deps({ usedToday: async () => 50 })
    expect(await runFeature('group', ctx(), { exempt: false }, full.d)).toMatchObject({ ok: false, error: expect.stringMatching(/50 Claude runs/) })
    const exempt = deps({ usedToday: async () => 500, lastRun: async () => 1_000_000 })
    expect((await runFeature('group', ctx(), { exempt: true }, exempt.d)).ok).toBe(true)
  })
  it('logs a failed call with the sentence for the person, saving nothing', async () => {
    const { d, calls } = deps({ err: new ClaudeError('Claude is busy. Try again soon.', 'rate') })
    expect(await runFeature('group', ctx(), { exempt: false }, d)).toEqual({ ok: false, error: 'Claude is busy. Try again soon.' })
    expect(calls.saved).toHaveLength(0)
    expect(calls.logs[0]).toMatchObject({ ok: false, error: 'Claude is busy. Try again soon.' })
  })
  it('hides an unexpected error behind one line', async () => {
    const { d } = deps({ err: new Error('secret socket detail') })
    const r = await runFeature('group', ctx(), { exempt: false }, d)
    expect(r).toEqual({ ok: false, error: 'Claude could not be reached. Try again in a moment.' })
  })
  it('does not save an answer it cannot read, and still counts the tokens', async () => {
    for (const text of ['I cannot do that', '{"groups":[]}']) {
      const { d, calls } = deps({ text })
      expect(await runFeature('group', ctx(), { exempt: false }, d)).toMatchObject({ ok: false, error: expect.stringMatching(/not in a form|could not be read|returned no groups/) })
      expect(calls.saved).toHaveLength(0)
      expect(calls.logs[0]).toMatchObject({ ok: false, inputTokens: 10 })
    }
  })
  it('saves the empty answer of a placement run with nothing to place, without a call', async () => {
    const { d, calls } = deps()
    const c: AiContext = { ...ctx(), analysis: analysis(project({ terms: [{ t: 'moisture meter', tier: 'high' }] }), PAGES), draftHtml: '<h1>x</h1><p>A moisture meter helps.</p>' }
    expect(await runFeature('place', c, { exempt: false }, d)).toEqual({ ok: true, model: '' })
    expect(calls.requests).toHaveLength(0)
    expect(calls.saved).toEqual([{ placements: expect.objectContaining({ list: [], skip: [] }) }])
  })
})
