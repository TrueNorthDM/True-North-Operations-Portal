'use server'

/**
 * Remind on North Time > TSheets transition (owner, 28 October 2026): tells
 * one person, in the bell, which of their TSheets entries in the period the
 * portal cannot read in the 2026 structure and what to change on each, to fix
 * in QuickBooks Time. Super Admins and Admins (ck-transition), never from a
 * View Stage preview. The same entries are told once a day.
 */

import { createHash } from 'node:crypto'
import { writerAccess } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { localDate } from '@/lib/timeclock/format'
import { reminderText } from '@/lib/timeclock/transition-check'
import { loadTransition } from '@/lib/timeclock/transition-data'
import { loadDirectory } from '@/lib/timeclock/clocky-context'
import { notifyClockyTsheetsFix } from '@/lib/notifications/run'

type Done = { ok: true; toast: string } | { ok: false; error: string }
const no = (error: string): Done => ({ ok: false, error })

export async function remindTransition(input: { personId: string; from?: string | null; to?: string | null }): Promise<Done> {
  if (await getViewAs()) return no('View Stage is only a preview. Close it to send a reminder.')
  const access = await writerAccess()
  if (!access) return no('Sign in again to send a reminder.')
  if (!access.can('ck-transition')) return no('Only Super Admins and Admins send these reminders.')
  try {
    const personId = String(input.personId ?? '')
    const data = await loadTransition({ from: input.from, to: input.to, person: personId, problems: true })
    if (!data.switchDate || data.personId !== personId) return no('That person has no TSheets entries in this period.')
    const rows = data.rows.filter(r => r.personId === personId && r.problems.length)
    if (!rows.length) return no('Nothing to fix for that person in this period.')
    const dir = await loadDirectory()
    const { title, body } = reminderText(rows)
    // Once a day for the same entries: a second press the same day is not a second bell row.
    // Hashed, so a long list of entries still makes a short key.
    const ids = rows.map(r => r.id).sort((a, b) => a - b).join(',')
    const key = `${localDate(new Date(), dir.zoneOf(personId))}:${createHash('sha256').update(ids).digest('hex').slice(0, 24)}`
    const res = await notifyClockyTsheetsFix({ personId, title, body, key })
    if (res.error || res.skipped || Object.keys(res.failed ?? {}).length) return no('The reminder was not sent. Try again in a moment.')
    const name = dir.nameOf(personId)
    // The bell reaches people with a portal login and an invitation (lib/notifications/audience.ts).
    if (!res.drafts) return no(`${name} has no portal login yet, so the bell cannot reach them. Tell them another way.`)
    // Planned but not written: the person turned these off, or was told of the same entries today (audit, 29 October 2026).
    if (!res.rows) return no(`${name} was not told: they turned these reminders off, or were already reminded of these entries today.`)
    return { ok: true, toast: `Reminder sent to ${name}: ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} to fix in QuickBooks Time.` }
  } catch (e) {
    console.error('[clocky transition] remind:', (e as Error).message)
    return no('The reminder was not sent. Try again in a moment.')
  }
}
