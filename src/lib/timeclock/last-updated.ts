/**
 * When anything on Project Hours & Others last changed, and what changed.
 *
 * "Last synced" would have been the easy thing to copy from the i7 report and
 * the wrong thing to show here. It measures one pipeline, the QuickBooks Time
 * import, and this report has three sources with three clocks: imported hours,
 * hours added by hand, and donations and prepaid typed into Money in. Enter six
 * thousand dollars of donations and a sync badge does not move, which reads as
 * "your figure is not in yet" when it is sitting on the row above.
 *
 * So this takes the newest of the three and says which one it was. A single
 * timestamp is only honest if it actually covers everything the page shows.
 *
 * Scoped to the months on screen for the two hand-entered sources, because that
 * is what the reader is looking at. The import is not: it runs for everything
 * at once, and there is no such thing as importing only September.
 */

import type { Db } from '@/lib/supabase/types'
import { getHoursImportStatus } from './import-status'

type Client = Db

/** Which of the three moved last. The wording on screen depends on it. */
export type UpdateSource = 'import' | 'hours' | 'money'

export interface LastUpdated {
  at: string | null
  source: UpdateSource | null
  /** The last import attempt failed, so the imported hours are older than they look. */
  importFailed: boolean
}

const WORDS: Record<UpdateSource, string> = {
  import: 'hours imported from QuickBooks Time',
  hours: 'hours added by hand',
  money: 'donations or prepaid hours',
}

export function sourceWording(source: UpdateSource): string {
  return WORDS[source]
}

/**
 * The newest of what was handed in, and which source it was.
 *
 * Pulled out of the loader so the rule can be checked without a database. It is
 * the whole feature: show one timestamp only if it genuinely covers everything
 * the page shows.
 */
export function newestOf(
  candidates: readonly { at: string | null | undefined; source: UpdateSource }[],
): { at: string; source: UpdateSource } | null {
  const real = candidates.filter((c): c is { at: string; source: UpdateSource } => Boolean(c.at))
  if (real.length === 0) return null
  return real.reduce((a, b) => (b.at > a.at ? b : a))
}

export async function loadLastUpdated(
  supabase: Client,
  from: string,
  to: string,
): Promise<LastUpdated> {
  const start = `${from}-01`
  // The first day of the month after `to`, so the whole of `to` is inside.
  const [ty, tm] = to.split('-').map(Number)
  const end = new Date(Date.UTC(ty, tm, 1)).toISOString().slice(0, 10)

  const [imported, handEntered, donated, bought] = await Promise.all([
    getHoursImportStatus(),
    supabase.from('tc_entries').select('updated_at')
      .eq('kind', 'manual').is('external_id', null)
      .gte('entry_date', start).lt('entry_date', end)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('tc_project_donations').select('updated_at')
      .gte('month', from).lte('month', to)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('tc_project_purchases').select('updated_at')
      .gte('month', from).lte('month', to)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  // Donations and purchases are one thing to the reader: money typed in.
  const moneyAt = [donated.data?.updated_at, bought.data?.updated_at]
    .filter((t): t is string => Boolean(t))
    .sort()
    .pop() ?? null

  const newest = newestOf([
    { at: imported.syncedAt, source: 'import' },
    { at: handEntered.data?.updated_at, source: 'hours' },
    { at: moneyAt, source: 'money' },
  ])

  return {
    at: newest?.at ?? null,
    source: newest?.source ?? null,
    importFailed: imported.failed,
  }
}
