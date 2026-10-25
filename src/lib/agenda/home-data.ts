/**
 * The Agenda card on Home, read on the server: the Agenda's own items from today
 * to a month ahead (loadAgendaItems, so the same people and events the viewer
 * sees on /agenda), in the viewer's zone, with the Directory's photos.
 */

import type { Access } from '@/lib/access/resolve'
import { loadDirectory } from '@/lib/timeclock/clocky-context'
import { localDate, localMinutes } from '@/lib/timeclock/format'
import { addDays } from '@/lib/timeclock/periods'
import { agendaViewer, loadAgendaItems } from './data'
import { homeAgenda, type HomeAgenda } from './home'

/** null when the login is not linked to a person; 'unavailable' when a read fails (the card says so, never empty). */
export async function loadHomeAgenda(access: Pick<Access, 'personId' | 'level'>, now = new Date()): Promise<HomeAgenda | 'unavailable' | null> {
  try {
    const v = await agendaViewer(access)
    if (!v) return null
    const today = localDate(now, v.zone)
    const [items, dir] = await Promise.all([loadAgendaItems(v, today, addDays(today, 31)), loadDirectory()])
    return homeAgenda(items, today, localMinutes(now, v.zone) / 60, id => dir.people.get(id)?.avatarUrl ?? null)
  } catch (e) {
    console.error('[home] agenda:', (e as Error).message)
    return 'unavailable'
  }
}
