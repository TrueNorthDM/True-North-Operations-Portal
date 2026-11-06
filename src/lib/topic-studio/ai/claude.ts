/**
 * The only place Topic Studio talks to Claude (phase 3, 6 November 2026), through
 * the official SDK. The key is ANTHROPIC_API_KEY, set on the server (portal.env
 * and staging.env); it never reaches the browser. Until it is set,
 * claudeConfigured() is false and every Claude button says so instead of failing.
 *
 * A request streams (so a long answer is not cut by a timeout), carries only the
 * model and effort of the feature (thinking is adaptive on these models, so it is
 * not sent), and asks for the server-side fallback where the model supports it:
 * a request the safety classifiers decline is retried on another model inside the
 * same call. The whole call is cut at 90 seconds, under the 100 seconds the
 * proxy in front of the portal allows.
 *
 * Features depend on the small ClaudeClient interface, not on the SDK, so their
 * tests run against a fake that answers with canned text.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { Effort } from './settings'

export interface ClaudeRequest {
  model: string
  effort: Effort
  system: string
  prompt: string
  maxTokens?: number
}

export interface ClaudeResult {
  text: string
  /** The model that answered (a fallback may have). */
  model: string
  inputTokens: number
  outputTokens: number
  ms: number
}

export interface ClaudeClient { complete(req: ClaudeRequest): Promise<ClaudeResult> }

/** A failure with a sentence that is safe to show the person. */
export class ClaudeError extends Error {
  constructor(message: string, readonly code: 'not_configured' | 'auth' | 'rate' | 'bad_request' | 'refusal' | 'cut_off' | 'timeout' | 'network' | 'unknown') { super(message) }
}

export const claudeConfigured = (): boolean => !!process.env.ANTHROPIC_API_KEY?.trim()

/** Time allowed for one call. */
export const CALL_MS = 90_000
const MAX_TOKENS = 32_000

/** Models that accept the server-side fallback (Haiku and unknown models do not). */
export const supportsFallback = (model: string): boolean => /^claude-(opus-5|sonnet-5-5|fable)/.test(model)

export const SYSTEM_PROMPT = [
  'You help the SEO and writing team at True North Digital Marketing prepare content briefs and review drafts.',
  'Reply only in the format the task asks for (usually one JSON object) with no text before or after it.',
  'Write plainly. Never use the em dash character: use a comma, colon, period or parentheses instead.',
].join(' ')

/** The sentence for an SDK error. */
export function explain(e: unknown): ClaudeError {
  if (e instanceof ClaudeError) return e
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return new ClaudeError('Claude did not accept the key this portal has. An Admin needs to check the Anthropic key on the server.', 'auth')
  if (e instanceof Anthropic.RateLimitError) return new ClaudeError('Claude is busy right now. Try again in a minute.', 'rate')
  if (e instanceof Anthropic.BadRequestError || e instanceof Anthropic.NotFoundError) return new ClaudeError('Claude could not run this with the model or settings chosen. An Admin can check the model in the Topic Studio settings.', 'bad_request')
  if (e instanceof Anthropic.APIConnectionTimeoutError) return new ClaudeError('Claude took too long to answer. Try again; a shorter draft or fewer pages helps.', 'timeout')
  if (e instanceof Anthropic.APIConnectionError) return new ClaudeError('The portal could not reach Claude. Try again in a moment.', 'network')
  if (e instanceof Anthropic.APIError) return new ClaudeError('Claude is not available right now. Try again in a moment.', 'unknown')
  return new ClaudeError('Claude could not finish that. Try again in a moment.', 'unknown')
}

/** The real client, over the SDK. */
export function anthropicClient(apiKey: string): ClaudeClient {
  const sdk = new Anthropic({ apiKey, timeout: CALL_MS, maxRetries: 1 })
  return {
    async complete(req) {
      const started = Date.now()
      try {
        const stream = sdk.beta.messages.stream({
          model: req.model,
          max_tokens: req.maxTokens ?? MAX_TOKENS,
          system: req.system,
          messages: [{ role: 'user', content: req.prompt }],
          output_config: { effort: req.effort },
          ...(supportsFallback(req.model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
        } as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming, { signal: AbortSignal.timeout(CALL_MS) })
        const msg = await stream.finalMessage()
        if (msg.stop_reason === 'refusal') throw new ClaudeError('Claude declined to work on this text. Try again with different wording, or tell an Admin if it keeps happening.', 'refusal')
        const text = msg.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('')
        if (msg.stop_reason === 'max_tokens') throw new ClaudeError('Claude’s answer was cut off because it was too long. Try again with less text.', 'cut_off')
        return { text, model: msg.model, inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens, ms: Date.now() - started }
      } catch (e) {
        if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw new ClaudeError('Claude took too long to answer. Try again; a shorter draft or fewer pages helps.', 'timeout')
        throw explain(e)
      }
    },
  }
}

/** The client for this server, or null while no key is set. */
export function defaultClient(): ClaudeClient | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim()
  return key ? anthropicClient(key) : null
}
