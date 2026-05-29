/**
 * Translate a raw `monday_events.result` string into a short, human-readable
 * summary for the activity feed on the project page.
 *
 * The raw strings (produced in handlers.ts) are designed to be greppable
 * for debugging — they include the language code, missing langs, sibling
 * count, etc. The activity feed wants them readable instead, so we
 * normalize: language codes → uppercase, "ok:" prefix dropped, etc.
 *
 * Categorizes severity so the feed can color-code:
 *   - 'ok'      → page got created/updated successfully
 *   - 'warn'    → something was skipped on purpose (unknown lang, item
 *                 not in Monday, etc.) — usually user-fixable
 *   - 'error'   → actual failure (DB error, API error) — bug-fixable
 */

export type ActivitySeverity = 'ok' | 'warn' | 'error'

export interface ActivitySummary {
  severity: ActivitySeverity
  message: string
}

const LANG_LABEL: Record<string, string> = {
  en: 'English',
  pt: 'Portuguese',
  es: 'Spanish',
  sw: 'Swahili',
  fr: 'French',
}

function langLabel(code: string): string {
  return LANG_LABEL[code] ?? code.toUpperCase()
}

export function summarizeResult(result: string | null): ActivitySummary {
  if (!result) return { severity: 'warn', message: 'No outcome recorded' }

  // ── Successful Run Link saves ────────────────────────────────────
  // "ok:saved en (waiting on: sw)"
  const savedMatch = result.match(/^ok:saved (\w+) \(waiting on: ([\w,]+)\)$/)
  if (savedMatch) {
    const lang = langLabel(savedMatch[1])
    const waiting = savedMatch[2].split(',').map(langLabel).join(', ')
    return {
      severity: 'ok',
      message: `${lang} URL received — still waiting on ${waiting}`,
    }
  }

  // "ok:applied Apply Link to N sibling items"
  const appliedMatch = result.match(/^ok:applied Apply Link to (\d+) sibling items?$/)
  if (appliedMatch) {
    return {
      severity: 'ok',
      message: `All languages received → Monday set to Apply Link (${appliedMatch[1]} items)`,
    }
  }

  // "partial:applied to X/Y; failed: ..."
  if (result.startsWith('partial:')) {
    return { severity: 'warn', message: result.replace(/^partial:/, 'Partial apply: ') }
  }

  // ── Done handler ─────────────────────────────────────────────────
  // "ok:confirmed en (monday=done, all-live=true) [stamped All Live]"
  const confirmMatch = result.match(/^ok:confirmed (\w+) \(monday=(\w+), all-live=(true|false)\)(.*)$/)
  if (confirmMatch) {
    const lang = langLabel(confirmMatch[1])
    const stamped = confirmMatch[4].includes('stamped')
    if (stamped) {
      return { severity: 'ok', message: `${lang} marked Done — page now fully live ✓` }
    }
    return { severity: 'ok', message: `${lang} marked Done in Monday` }
  }

  // ── Skips ─────────────────────────────────────────────────────────
  if (result.startsWith('skipped:column')) {
    return { severity: 'warn', message: 'Skipped (column not Href Links)' }
  }
  if (result.includes('not found in Monday')) {
    return { severity: 'warn', message: 'Item no longer in Monday' }
  }
  if (result.includes('unknown language')) {
    return { severity: 'warn', message: result.replace(/^skipped:/, '').trim() }
  }
  if (result.includes('empty Page Link')) {
    return { severity: 'warn', message: 'Item has no Page Link URL yet' }
  }
  if (result.includes('not in DB')) {
    return { severity: 'warn', message: 'Done arrived before Run Link — page not in system yet' }
  }
  if (result.startsWith('skipped:')) {
    return { severity: 'warn', message: result.replace(/^skipped:/, '').trim() }
  }

  // ── Errors ───────────────────────────────────────────────────────
  if (result.startsWith('error:')) {
    return { severity: 'error', message: result.replace(/^error:/, '').trim() }
  }

  // Fallback — show raw
  return { severity: 'warn', message: result }
}

/**
 * Format a timestamp as "5m ago", "2h ago", "yesterday", etc.
 * Falls back to a date for older than ~7 days.
 */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const secs = Math.max(0, Math.floor((now - then) / 1000))
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
