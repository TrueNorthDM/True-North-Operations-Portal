/**
 * The new Agenda's sample data on staging (owner, 30 October 2026), for the
 * training sessions: the team calendar, a Google account for almost everyone
 * (the owner gets two, a few people none, to show the Connect state), working
 * hours and six weeks of busy times. Staging only; safe to run again: accounts
 * and settings are kept, sample busy times are written again the same way.
 * Server only. Run by /api/cron/agenda-sample-seed.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { IS_STAGING } from '@/lib/environment'
import { loadDirectory } from '@/lib/timeclock/clocky-context'
import { sampleBusy, sampleHours, seeded } from './sample-plan'
import { readHours } from './working-hours'
import { APPROVED_DOMAIN } from './accounts'

const TEAM_CALENDAR = `office@${APPROVED_DOMAIN}`
/** The owner's two accounts in the approved mockup (he has no work address in the Directory). */
const OWNER_ACCOUNTS = ['arnaldo@truenorthdigitalmarketing.com', 'arnaldo@leveluponline.org']

export interface SeedReport { accounts: number; withoutAccount: number; busy: number; settings: number }

export async function seedAgendaSamples(c: SupabaseClient, today: string): Promise<SeedReport> {
  if (!IS_STAGING) throw new Error('Sample data is for staging only.')
  const dir = await loadDirectory()
  const { data: people, error } = await c.from('people').select('id, full_name, email_true_north, email_goodnews').eq('status', 'active').order('full_name')
  if (error) throw new Error(`People could not be read: ${error.message}`)
  // Each person's sample account: the work address, else the Good News one.
  const rows = ((people ?? []) as { id: string; full_name: string; email_true_north: string | null; email_goodnews: string | null }[])
    .map(p => ({ id: p.id, name: p.full_name, email: (p.email_true_north || p.email_goodnews || '').trim().toLowerCase() }))
  const owner = rows.find(p => p.name.trim().toLowerCase() === 'arnaldo oliveira')
  const people2 = rows.filter(p => p.email || p.id === owner?.id)
  // About three people without an account, to show the Connect state; never the owner.
  const without = new Set(people2.filter(p => p.id !== owner?.id && seeded(`none:${p.id}`)() < 0.1).slice(0, 3).map(p => p.id))

  // The team calendar.
  const { data: team } = await c.from('agenda_accounts').select('id').eq('team_calendar', true).maybeSingle()
  if (!team) {
    const { error: e } = await c.from('agenda_accounts').insert({ person_id: null, team_calendar: true, email: TEAM_CALENDAR, source: 'sample', connected_by: owner?.id ?? null })
    if (e) throw new Error(`The team calendar could not be added: ${e.message}`)
  }

  // Accounts: the work address, and the owner's second one. Existing rows are kept.
  const wanted = people2.filter(p => !without.has(p.id)).flatMap(p => (p.id === owner?.id ? OWNER_ACCOUNTS : [p.email]).map(email => ({ person_id: p.id, email })))
  const { data: existing, error: exErr } = await c.from('agenda_accounts').select('id, person_id, email').not('person_id', 'is', null)
  if (exErr) throw new Error(`Accounts could not be read: ${exErr.message}`)
  const have = new Set((existing ?? []).map(a => (a.email as string).toLowerCase()))
  const add = wanted.filter(a => !have.has(a.email)).map(a => ({ ...a, source: 'sample', connected_by: a.person_id }))
  if (add.length) {
    const { error: e } = await c.from('agenda_accounts').insert(add)
    if (e) throw new Error(`Accounts could not be added: ${e.message}`)
  }

  // Working hours for whoever has none yet.
  const { data: set } = await c.from('agenda_person_settings').select('person_id')
  const hasSettings = new Set((set ?? []).map(s => s.person_id as string))
  const settings = people2.filter(p => !hasSettings.has(p.id)).map(p => ({ person_id: p.id, working_hours: sampleHours(p.id) }))
  if (settings.length) {
    const { error: e } = await c.from('agenda_person_settings').insert(settings)
    if (e) throw new Error(`Working hours could not be added: ${e.message}`)
  }

  // Busy times: six weeks from a week ago, written again for every sample account.
  const { data: accounts, error: aErr } = await c.from('agenda_accounts').select('id, person_id, email').eq('source', 'sample').not('person_id', 'is', null)
  if (aErr) throw new Error(`Accounts could not be read: ${aErr.message}`)
  const { data: hoursRows } = await c.from('agenda_person_settings').select('person_id, working_hours')
  const hoursOf = new Map((hoursRows ?? []).map(h => [h.person_id as string, h.working_hours]))
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - 7 * 864e5).toISOString().slice(0, 10)
  const ids = (accounts ?? []).map(a => a.id as number)
  if (ids.length) {
    const { error: e } = await c.from('agenda_busy').delete().eq('source', 'sample').in('account_id', ids)
    if (e) throw new Error(`Old sample busy times could not be cleared: ${e.message}`)
  }
  const busy = (accounts ?? []).flatMap(a => {
    const pid = a.person_id as string
    return sampleBusy(String(a.email), readHours(hoursOf.get(pid)), dir.zoneOf(pid), from, 49)
      .map(([s, e]) => ({ account_id: a.id as number, starts_at: new Date(s).toISOString(), ends_at: new Date(e).toISOString(), source: 'sample' }))
  })
  for (let i = 0; i < busy.length; i += 1000) {
    const { error: e } = await c.from('agenda_busy').insert(busy.slice(i, i + 1000))
    if (e) throw new Error(`Busy times could not be added: ${e.message}`)
  }
  return { accounts: add.length, withoutAccount: without.size, busy: busy.length, settings: settings.length }
}
