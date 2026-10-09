/**
 * A person's own settings (person_settings, migrations 092 and 093), behind the
 * personal Settings page (7 October 2026): their time zone and the hour of
 * their daily summary, the page they land on after signing in, their
 * favourite pages on Home, and whether Home shows their birthday and work
 * anniversary.
 *
 * Read and written with the privileged client for the person the server has
 * already identified (like the notification tables). Every reader degrades to
 * the defaults while the migration has not been run. `cleanSettings` checks
 * what a browser sent; it is pure and tested.
 */

import type { Db } from '@/lib/supabase/types'
import { DAILY_HOUR, DAILY_ZONE } from '@/lib/notifications/catalogue'
import { validZone } from '@/lib/notifications/schedule'
import { missingTable } from '@/lib/supabase/errors'

type Client = Db

export type StartPage = 'home' | 'my-work'

export interface PersonSettings {
  timeZone: string
  /** Whether they chose a zone, or follow the company's. */
  ownZone: boolean
  summaryHour: number
  startPage: StartPage
  /** Navigation keys, in order, at most FAVOURITES_MAX. */
  favourites: string[]
  showBirthday: boolean
  showAnniversary: boolean
}

export const FAVOURITES_MAX = 5
/** The hours a summary can land at. */
export const SUMMARY_HOURS: readonly number[] = [6, 7, 8, 9, 10]
export const START_PAGES: readonly { key: StartPage; label: string; href: string }[] = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'my-work', label: 'My Work', href: '/my-work' },
]

export const DEFAULT_SETTINGS: PersonSettings = {
  timeZone: DAILY_ZONE, ownZone: false, summaryHour: DAILY_HOUR, startPage: 'home',
  favourites: [], showBirthday: true, showAnniversary: true,
}

type Row = {
  person_id: string; time_zone: string | null; summary_hour: number | null; start_page: string | null
  favourites: string[] | null; show_birthday: boolean | null; show_anniversary: boolean | null
}

function fromRow(r: Partial<Row> | null | undefined): PersonSettings {
  if (!r) return { ...DEFAULT_SETTINGS }
  return {
    timeZone: validZone(r.time_zone),
    ownZone: !!r.time_zone,
    summaryHour: r.summary_hour != null && SUMMARY_HOURS.includes(r.summary_hour) ? r.summary_hour : DAILY_HOUR,
    startPage: r.start_page === 'my-work' ? 'my-work' : 'home',
    favourites: (r.favourites ?? []).slice(0, FAVOURITES_MAX),
    showBirthday: r.show_birthday ?? true,
    showAnniversary: r.show_anniversary ?? true,
  }
}

/**
 * Settings for several people at once; anyone missing has the defaults. A
 * screen keeps going on the defaults if the read fails; `strict` (sending a
 * summary) throws instead, so nobody is emailed at the wrong hour.
 */
export async function loadSettingsFor(db: Client, personIds: readonly string[], opts: { strict?: boolean } = {}): Promise<Map<string, PersonSettings>> {
  const out = new Map<string, PersonSettings>()
  for (let i = 0; i < personIds.length; i += 200) {
    // Typed loosely: the fallback reads fewer columns when a migration has not run.
    let res: { data: unknown[] | null; error: unknown } = await db.from('person_settings').select('*').in('person_id', personIds.slice(i, i + 200))
    if (res.error) res = await db.from('person_settings').select('person_id, time_zone').in('person_id', personIds.slice(i, i + 200))
    if (res.error) {
      if (opts.strict && !missingTable(res.error as { code?: string; message?: string })) {
        throw new Error(`Personal settings could not be read: ${(res.error as { message?: string }).message ?? 'unknown error'}`)
      }
      break
    }
    for (const r of (res.data ?? []) as Row[]) out.set(r.person_id, fromRow(r))
  }
  return out
}

export async function loadSettings(db: Client, personId: string): Promise<PersonSettings> {
  return (await loadSettingsFor(db, [personId])).get(personId) ?? { ...DEFAULT_SETTINGS }
}

/** The people who asked Home not to show their birthday, or their anniversary. */
export async function loadCelebrationOptOuts(db: Client): Promise<{ birthday: Set<string>; anniversary: Set<string> }> {
  const out = { birthday: new Set<string>(), anniversary: new Set<string>() }
  const { data, error } = await db.from('person_settings').select('person_id, show_birthday, show_anniversary')
    .or('show_birthday.eq.false,show_anniversary.eq.false')
  if (error) return out
  for (const r of (data ?? []) as Row[]) {
    if (r.show_birthday === false) out.birthday.add(r.person_id)
    if (r.show_anniversary === false) out.anniversary.add(r.person_id)
  }
  return out
}

/** A change a browser may send: any subset of the settings. */
export interface SettingsPatch {
  timeZone?: string | null
  summaryHour?: number
  startPage?: StartPage
  favourites?: string[]
  showBirthday?: boolean
  showAnniversary?: boolean
}

/**
 * What a browser sent, checked: known values only, favourites deduplicated
 * and cut to the maximum (which keys the person may pin is checked by the
 * caller, against their own navigation). Null when it cannot be read.
 */
export function cleanSettings(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const out: Record<string, unknown> = {}
  if ('timeZone' in o) {
    if (o.timeZone === null) out.time_zone = null
    else if (typeof o.timeZone === 'string' && validZone(o.timeZone) === o.timeZone) out.time_zone = o.timeZone
    else return null
  }
  if ('summaryHour' in o) {
    if (typeof o.summaryHour !== 'number' || !SUMMARY_HOURS.includes(o.summaryHour)) return null
    out.summary_hour = o.summaryHour
  }
  if ('startPage' in o) {
    if (o.startPage !== 'home' && o.startPage !== 'my-work') return null
    out.start_page = o.startPage
  }
  if ('favourites' in o) {
    if (!Array.isArray(o.favourites) || !o.favourites.every(k => typeof k === 'string' && /^[a-z0-9-]{1,60}$/.test(k))) return null
    out.favourites = [...new Set(o.favourites as string[])].slice(0, FAVOURITES_MAX)
  }
  for (const [k, col] of [['showBirthday', 'show_birthday'], ['showAnniversary', 'show_anniversary']] as const) {
    if (k in o) {
      if (typeof o[k] !== 'boolean') return null
      out[col] = o[k]
    }
  }
  return Object.keys(out).length ? out : null
}

/** Where someone lands after signing in, when no page was asked for. */
export async function startPageFor(db: Client, personId: string): Promise<string> {
  const s = await loadSettings(db, personId)
  return START_PAGES.find(p => p.key === s.startPage)?.href ?? '/'
}
