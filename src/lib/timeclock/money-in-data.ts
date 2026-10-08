/**
 * What has already been entered for a month, so the form opens on it.
 *
 * A form that opens empty over figures that exist invites somebody to type them
 * again, and the second entry silently replaces the first. Opening on what is
 * there makes editing and entering the same act.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { TRACKED_PROJECTS } from './projects'

// Same shape the sibling loaders take: the generated types do not cover the
// privileged client, and narrowing here would only move the cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>

export interface MoneyInMonth {
  month: string
  /** Amount given, keyed by project label. Only the donation-funded two can have one. */
  donations: Record<string, string>
  /** Hours bought, keyed by project label. Only the prepaid two can have any. */
  purchases: Record<string, { hours: string; amount: string }>
}

export async function loadMoneyIn(supabase: Client, month: string): Promise<MoneyInMonth> {
  const [{ data: giftRows, error: giftError }, { data: buyRows, error: buyError }] = await Promise.all([
    supabase.from('tc_project_donations').select('project_label, amount_usd').eq('month', month),
    supabase.from('tc_project_purchases').select('project_label, hours, amount_usd').eq('month', month),
  ])
  // A failed read must never come back as empty fields: the form saves every
  // field, and saving a blank one takes that month's figure out.
  if (giftError || buyError) throw new Error(`Money in could not be read: ${(giftError ?? buyError)!.message}`)

  const donations: Record<string, string> = {}
  for (const g of (giftRows ?? []) as { project_label: string | null; amount_usd: number }[]) {
    if (g.project_label) donations[g.project_label] = String(Number(g.amount_usd))
  }

  const purchases: Record<string, { hours: string; amount: string }> = {}
  for (const b of (buyRows ?? []) as { project_label: string; hours: number; amount_usd: number | null }[]) {
    purchases[b.project_label] = {
      hours: String(Number(b.hours)),
      amount: b.amount_usd == null ? '' : String(Number(b.amount_usd)),
    }
  }

  // Every bucket present, so the form draws a field for each whether or not
  // anybody has entered one. An absent key and an empty one mean the same thing
  // to the form and it should not have to know the difference.
  for (const p of TRACKED_PROJECTS) {
    if (p.prepaid) purchases[p.label] ??= { hours: '', amount: '' }
    else donations[p.label] ??= ''
  }

  return { month, donations, purchases }
}

/**
 * A typed figure, or the reason it is not one.
 *
 * Blank returns null and null means "take this row out", not zero. The report
 * draws a month nobody has entered differently from a month where nothing came
 * in, so storing 0 for an empty field would turn "nobody has said" into "none",
 * and there would be no way left to undo a figure entered by mistake.
 *
 * Money arrives pasted out of a bank statement, so the dollar sign, the commas
 * and the spaces that come with it are stripped rather than refused.
 */
export function parseMoney(raw: string, what: string): { value: number | null; error?: string } {
  const t = raw.trim()
  if (t === '') return { value: null }
  const n = Number(t.replace(/[$,\s]/g, ''))
  if (!Number.isFinite(n)) return { value: null, error: `${what} has to be a number.` }
  if (n < 0) return { value: null, error: `${what} cannot be negative.` }
  return { value: Math.round(n * 100) / 100 }
}
