/**
 * Agenda settings (owner, 30 October 2026): what /agenda/settings shows one
 * person. The team calendar (office@, a Super Admin connects it), the Google
 * accounts they connected, where invitations to them go, their working hours,
 * the holidays they see and their time zone. Server only.
 *
 * Google sign-in is not set up yet: accounts are added by address and marked
 * as samples (source 'sample'); the screens do not change when Google comes.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { loadDirectory } from '@/lib/timeclock/clocky-context'
import { countryOf } from './holidays'
import { countryName, flagOf } from './model'
import { DC, dcVersus, zoneLabel } from './time'
import { readHours, type WorkingHours } from './working-hours'

export interface AgendaAccount { id: number; email: string; sample: boolean; needsReconnect: boolean; connectedAt: string }

export interface AgendaSettingsData {
  superAdmin: boolean
  teamCalendar: (AgendaAccount & { by: string | null }) | null
  accounts: AgendaAccount[]
  /** The work address, where invitations go unless another account is chosen. */
  workEmail: string | null
  inviteAccountId: number | null
  hours: WorkingHours
  zone: { name: string; versus: string; isDc: boolean }
  /** The person's own country when it is not the US, for the Holidays card. */
  country: { code: string; name: string; flag: string } | null
}

/** Only these addresses connect until Google approves the portal (owner, 30 October 2026). */
export const APPROVED_DOMAIN = 'truenorthdigitalmarketing.com'

type AccountRow = { id: number; person_id: string | null; email: string; source: string; status: string; connected_at: string; connected_by: string | null }
const account = (r: AccountRow): AgendaAccount => ({ id: r.id, email: r.email, sample: r.source === 'sample', needsReconnect: r.status === 'needs_reconnect', connectedAt: r.connected_at })

export async function loadAgendaSettings(personId: string, superAdmin: boolean, now = Date.now()): Promise<AgendaSettingsData> {
  const c = createAdminClient()
  const [dir, accRes, setRes, personRes] = await Promise.all([
    loadDirectory(),
    c.from('agenda_accounts').select('id, person_id, email, source, status, connected_at, connected_by').or(`person_id.eq.${personId},team_calendar.eq.true`).order('connected_at'),
    c.from('agenda_person_settings').select('working_hours, invite_account_id').eq('person_id', personId).maybeSingle(),
    c.from('people').select('email_true_north, address, location').eq('id', personId).maybeSingle(),
  ])
  for (const r of [accRes, setRes, personRes]) if (r.error) throw new Error(`Agenda settings could not be read: ${r.error.message}`)
  const rows = (accRes.data ?? []) as AccountRow[]
  const team = rows.find(r => r.person_id === null) ?? null
  const mine = rows.filter(r => r.person_id === personId).map(account)
  const zone = dir.zoneOf(personId)
  const p = personRes.data as { email_true_north: string | null; address: { country?: string } | null; location: string | null } | null
  const cc = countryOf(p?.address ?? null, p?.location ?? null)
  const invite = (setRes.data?.invite_account_id as number | null) ?? null
  return {
    superAdmin,
    teamCalendar: team ? { ...account(team), by: team.connected_by ? dir.nameOf(team.connected_by) : null } : null,
    accounts: mine,
    workEmail: p?.email_true_north ?? null,
    inviteAccountId: mine.some(a => a.id === invite) ? invite : null,
    hours: setRes.data ? readHours(setRes.data.working_hours) : readHours(null),
    zone: { name: zoneLabel(zone), versus: dcVersus(zone, now), isDc: zone === DC },
    country: cc && cc !== 'US' ? { code: cc, name: countryName(cc), flag: flagOf(cc) } : null,
  }
}
