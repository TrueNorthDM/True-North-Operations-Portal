/**
 * Booking from a review (design handoff, E1 and G5): the Agenda's own New
 * event drawer, opened already filled in. A Meeting, its title, the first
 * slot of 45 minutes when both are free (find-time.ts), online with a Google
 * Meet link, the person as the guest, a short agenda as the description, sent
 * from the manager's own Google account. Only while the new Agenda is open:
 * the drawer is its own.
 */

import type { Access } from '@/lib/access/resolve'
import { agendaGoogleOpen } from '@/lib/agenda/google-lock'
import { loadAvailability, loadDrawerSetup, type DrawerSetup } from '@/lib/agenda/drawer-data'
import { nextFree } from '@/lib/agenda/find-time'
import type { DrawerEdit } from '@/lib/agenda/model'

export interface Booking { setup: DrawerSetup; preset: Partial<Omit<DrawerEdit, 'id' | 'occurrence'>>; note: string
  /** The slot is one both are free in (false: none was found, the drawer opens at 10 AM today). */
  free: boolean
}

export async function bookingFor(access: Access, o: { personId: string; title: string; description: string; note: string; today: string; minutes?: number
  /** More guests: the other reviewer, for one meeting for both parts (owner, 10 November 2026). */
  others?: string[] }): Promise<Booking | null> {
  if (!(await agendaGoogleOpen())) return null
  const setup = await loadDrawerSetup(access, [])
  if (!setup || !setup.types.includes('meeting')) return null
  const dur = o.minutes ?? 45
  let date = o.today, from = 600, free = false
  try {
    const people = await loadAvailability([setup.me.id, o.personId, ...(o.others ?? [])], o.today, 35)
    const first = nextFree(people.map(p => p.avail), o.today, dur, 1)[0]
    if (first) { date = first.day; from = first.start; free = true }
  } catch (e) {
    console.error('[review] find a time:', e instanceof Error ? e.message : e)
  }
  const emailOf = (id: string) => {
    const guest = setup.people.find(p => p.personId === id)
    return guest?.emails.find(e => e.tag === 'Work')?.email ?? guest?.emails[0]?.email
  }
  const guests = [o.personId, ...(o.others ?? [])].map(id => ({ personId: id, email: emailOf(id) })).filter((g): g is { personId: string; email: string } => !!g.email)
  const own = setup.accounts.filter(a => !a.team)
  return {
    setup,
    note: o.note,
    free,
    preset: {
      type: 'meeting', when: 'time', title: o.title, date, from, to: from + dur, how: 'online', place: '', audience: 'guests', teams: [],
      guests, client: '', description: o.description, accountId: own[0]?.id ?? null, repeat: null,
    },
  }
}
