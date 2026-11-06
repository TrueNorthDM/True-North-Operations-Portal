/**
 * One Claude run (phase 3, 6 November 2026): the limits, the call, the reading of
 * the answer and the save, in that order. The database and the client are
 * passed in, so the tests run it against fakes.
 *
 * Limits (owner's defaults, changeable in settings): a feature can be switched
 * off, some models are blocked, one person has a daily number of runs (Super
 * Admins are exempt) and waits a few seconds before running the same feature
 * again. Every run is logged, success or not, so Admins can read the usage.
 */

import { ClaudeError, SYSTEM_PROMPT, type ClaudeClient } from './claude'
import { NeedsMore, Unreadable, prepare, type AiContext } from './features'
import { parseLooseJSON } from './json'
import type { PromptKey } from './prompt-defs'
import { featureConfig } from './settings'
import type { Patch } from '../term-ops'

export interface RunDeps {
  client: ClaudeClient
  /** Successful runs by this person in the last 24 hours. */
  usedToday(): Promise<number>
  /** When this person last ran this feature, or null. */
  lastRun(): Promise<number | null>
  log(row: { model: string; ok: boolean; error: string; inputTokens: number; outputTokens: number; ms: number }): Promise<void>
  save(patch: Patch): Promise<void>
  now(): number
}

export type RunOutcome = { ok: true; model: string } | { ok: false; error: string }

export async function runFeature(key: PromptKey, ctx: AiContext, who: { exempt: boolean }, deps: RunDeps): Promise<RunOutcome> {
  const cfg = featureConfig(ctx.settings.ai, key)
  if (!cfg.on) return { ok: false, error: 'This Claude feature is switched off in settings.' }
  if (cfg.blockedModel) return { ok: false, error: `The model set for this feature (${cfg.blockedModel}) is not allowed. Ask an Admin to choose another in settings.` }

  let run
  try { run = prepare(key, ctx) }
  catch (e) {
    if (e instanceof NeedsMore) return { ok: false, error: e.message }
    throw e
  }

  if (!who.exempt) {
    const wait = ctx.settings.ai.cooldownSec * 1000
    const last = wait ? await deps.lastRun() : null
    if (last !== null && deps.now() - last < wait) return { ok: false, error: `Wait a few seconds before running this again (${Math.ceil((wait - (deps.now() - last)) / 1000)}s).` }
    if ((await deps.usedToday()) >= ctx.settings.ai.dailyCap) return { ok: false, error: `You have used your ${ctx.settings.ai.dailyCap} Claude runs for today. Try again tomorrow.` }
  }

  // A feature with nothing to ask (every term already placed) saves its empty answer without a call.
  if (run.prompt === null) {
    await deps.save(run.apply(null))
    return { ok: true, model: '' }
  }

  const started = deps.now()
  const fail = async (error: string, model = cfg.model): Promise<RunOutcome> => {
    await deps.log({ model, ok: false, error, inputTokens: 0, outputTokens: 0, ms: deps.now() - started })
    return { ok: false, error }
  }

  let res
  try { res = await deps.client.complete({ model: cfg.model, effort: cfg.effort, system: SYSTEM_PROMPT, prompt: run.prompt }) }
  catch (e) {
    if (e instanceof ClaudeError) return fail(e.message)
    console.error('[topic-studio] claude', e)
    return fail('Claude could not be reached. Try again in a moment.')
  }

  let patch: Patch
  try {
    const answer = parseLooseJSON(res.text)
    if (answer === undefined) throw new Unreadable('Claude answered, but not in a form this tool can read. Try again.')
    patch = run.apply(answer)
  } catch (e) {
    const msg = e instanceof Unreadable ? e.message : 'Claude answered, but not in a form this tool can read. Try again.'
    if (!(e instanceof Unreadable)) console.error('[topic-studio] apply', e)
    await deps.log({ model: res.model, ok: false, error: msg, inputTokens: res.inputTokens, outputTokens: res.outputTokens, ms: res.ms })
    return { ok: false, error: msg }
  }

  await deps.save(patch)
  await deps.log({ model: res.model, ok: true, error: '', inputTokens: res.inputTokens, outputTokens: res.outputTokens, ms: res.ms })
  return { ok: true, model: res.model }
}
