/**
 * Turns a raw `monday_events.result` into a short sentence for the Href Links
 * activity feed on each site's page.
 *
 * The raw strings (written by the Monday webhook, lib/monday) are made to be
 * searched while debugging: language codes, item ids, the database's own
 * wording. The feed is read by the SEO team, so it says what happened in plain
 * words and keeps the database's wording out.
 *
 * Severity drives the colour of the tag in front of each line:
 *   ok     a page or link was created, updated or confirmed
 *   warn   something was skipped on purpose, usually fixable in Monday
 *   error  a step failed (Monday unreachable, a write refused)
 *
 * Since the audit of 10 October 2026 the webhook also writes a refused link
 * ("skipped:link for es refused (...)"), a status that moved on before the
 * portal read it ("skipped:label is now ..."), Monday being unreachable
 * ("error:monday (...)") and a live link changed in Monday ("ok:link changed
 * for es, confirmation removed"). The feed is shown so a failed Run Link is
 * seen (decided 10 October 2026), so each of those reads as a sentence.
 */

import { languageName } from '@/lib/language-display'
import { reportDate, REPORT_ZONE } from '@/lib/report/clock'

export type ActivitySeverity = 'ok' | 'warn' | 'error'

/**
 * Short category for the coloured tag in front of each entry. Maps one to one
 * to a colour in the ActivityLog component, so a new tag here needs its colour
 * there.
 */
export type ActivityTag =
  | 'URL_RECEIVED'  // a Run Link saved one language's link
  | 'APPLY_LINK'    // every language in; the portal set Apply Link in Monday
  | 'DONE'          // Monday Done received for one language
  | 'ALL_LIVE'      // every language live; the done date was stamped
  | 'DELETED'       // a person deleted the page in the portal
  | 'WARN'          // skipped on purpose, or a change that needs a look
  | 'ERROR'         // a step failed

export interface ActivitySummary {
  severity: ActivitySeverity
  tag: ActivityTag
  message: string
}

const warn = (message: string): ActivitySummary => ({ severity: 'warn', tag: 'WARN', message })
const error = (message: string): ActivitySummary => ({ severity: 'error', tag: 'ERROR', message })

/** "es,sw" -> "Spanish and Swahili". */
function languageList(codes: string): string {
  const names = codes.split(',').map(c => c.trim()).filter(Boolean).map(languageName)
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** First letter up, for a reason the feed shows as it was written. */
const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

function summarizeSkip(rest: string): ActivitySummary {
  let m: RegExpMatchArray | null

  // "link for es refused (The link is not a page on www.example.com.)"
  if ((m = rest.match(/^link for (\S+) refused \((.*)\)$/))) {
    return warn(`${languageName(m[1])} link not saved: ${m[2]}`)
  }
  // 'label is now "Working on it"': the status moved on before the portal read the item.
  if (/^label is now\b/.test(rest)) return warn('Ignored: the status changed again before the portal read it')
  if (rest.startsWith('column ')) return warn('Skipped (column not Href Links)')
  if (rest === 'duplicate delivery') return warn('Ignored: Monday sent the same change twice')
  if (rest.startsWith('missing column/board/item id')) return warn('Ignored: Monday sent an incomplete change')
  if (rest.startsWith('not a status change')) return warn('Ignored: not a status change')
  if ((m = rest.match(/^Href Links label "(.*)" not actionable$/))) {
    return warn(`Ignored: "${m[1]}" is not a step the portal acts on`)
  }
  if (rest.startsWith('unknown board')) return warn('Ignored: this board is not linked to a site in Settings')
  if (rest.startsWith('no column mapping')) return warn('Skipped: the site has no Monday columns set up')
  if (/not found in Monday/.test(rest)) return warn('Item no longer in Monday')
  if (/has no language label/.test(rest)) return warn('Skipped: the item has no language set in Monday')
  if ((m = rest.match(/^unknown language "(.*)"/))) return warn(`Skipped: "${m[1]}" is not a language the portal knows`)
  if ((m = rest.match(/^language (\S+) not configured/))) return warn(`Skipped: ${languageName(m[1])} is not one of this site's languages`)
  if (/empty Page Link/.test(rest)) return warn('Item has no Page Link yet')
  if (/not in DB/.test(rest)) return warn('Done arrived before Run Link: the page is not in the portal yet')
  return warn(`Skipped: ${rest}`)
}

function summarizeError(rest: string): ActivitySummary {
  if (rest.startsWith('monday')) return error('Monday could not be reached')
  if (rest.startsWith('upsert page_url')) return error('The link could not be saved')
  if (rest.startsWith('upsert page')) return error('The page could not be saved')
  if (rest.startsWith('upsert confirmation')) return error('The confirmation could not be saved')
  if (rest.startsWith('update page')) return error('The page could not be updated')
  // Anything new still reads as a failure, without the database's wording.
  return error(`Failed: ${rest.replace(/\s*\(.*\)\s*$/, '')}`)
}

export function summarizeResult(result: string | null): ActivitySummary {
  if (!result) return warn('No outcome recorded')
  let m: RegExpMatchArray | null

  // A person deleted the page: 'ok:deleted "PAGE NAME" by user@example.com'
  if ((m = result.match(/^ok:deleted "(.+)" by (.+)$/))) {
    return { severity: 'ok', tag: 'DELETED', message: `"${m[1]}" (by ${m[2]})` }
  }

  // "ok:saved en (waiting on: pt,sw)", or with nothing left to wait on.
  if ((m = result.match(/^ok:saved (\S+)(?: \(waiting on: ([^)]*)\))?$/))) {
    const lang = languageName(m[1])
    const waiting = m[2] ? languageList(m[2]) : ''
    return {
      severity: 'ok',
      tag: 'URL_RECEIVED',
      message: waiting ? `${lang} link received, still waiting on ${waiting}` : `${lang} link received`,
    }
  }

  // "ok:link changed for es, confirmation removed": WordPress still has the old tags.
  if ((m = result.match(/^ok:link changed for (\S+?)(, confirmation removed)?$/))) {
    const lang = languageName(m[1])
    return m[2]
      ? warn(`${lang} link changed in Monday: confirmation removed, page flagged`)
      : { severity: 'ok', tag: 'URL_RECEIVED', message: `${lang} link changed in Monday` }
  }

  // "ok:applied Apply Link to N sibling items"
  if ((m = result.match(/^ok:applied Apply Link to (\d+) sibling items?$/))) {
    return {
      severity: 'ok',
      tag: 'APPLY_LINK',
      message: `All languages received: Monday set to Apply Link (${m[1]} ${m[1] === '1' ? 'item' : 'items'})`,
    }
  }

  // "partial:applied to X/Y; failed: ..."
  if (result.startsWith('partial:')) return warn(result.replace(/^partial:/, 'Partly applied: '))

  // "ok:confirmed en (all-live=true) [stamped All Live]"; older rows also
  // carry "monday=done, " inside the brackets.
  if ((m = result.match(/^ok:confirmed (\S+) \((?:monday=\w+, )?all-live=(true|false)\)(.*)$/))) {
    const lang = languageName(m[1])
    return m[3].includes('stamped')
      ? { severity: 'ok', tag: 'ALL_LIVE', message: `${lang} marked Done, page now fully live ✓` }
      : { severity: 'ok', tag: 'DONE', message: `${lang} marked Done in Monday` }
  }

  if (result.startsWith('skipped:')) return summarizeSkip(result.slice('skipped:'.length).trim())
  if (result.startsWith('error:')) return summarizeError(result.slice('error:'.length).trim())

  // Something new: shown as written rather than hidden.
  return warn(sentence(result.replace(/^ok:/, '')))
}

/**
 * "5m ago", "2h ago", "3d ago"; a date ("Oct 9, 2026", New York day) from a
 * week on.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime()
  const secs = Math.max(0, Math.floor((now - then) / 1000))
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return reportDate(iso)
}

/** The exact moment, for the hover: "Oct 9, 2026, 3:05 PM" in New York. */
export function activityMoment(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: REPORT_ZONE, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}
