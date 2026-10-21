'use server'

// Changing the rules the clock runs by.
//
// Admin only, and validated here rather than trusted from the form: a number
// typed into a browser is a suggestion, and the one setting on this page that
// can lose data (the import cutoff) is exactly the one somebody will paste into
// by accident.

import { revalidatePath } from 'next/cache'
import { allowedTo } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Rules } from './RulesForm'

export interface Result { ok: boolean; error?: string }

const ZONES = new Set([
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Africa/Kigali', 'Africa/Nairobi', 'Europe/London', 'UTC',
])

export async function saveRules(input: Rules): Promise<Result> {
  if (!(await allowedTo('ck-rules'))) return { ok: false, error: 'Only an admin can change the rules.' }

  // Each of these is also a CHECK in migration 057. Repeating them here is not
  // redundancy for its own sake: the database refuses with a constraint name,
  // and a person changing a setting deserves a sentence.
  if (!ZONES.has(input.timezone)) return { ok: false, error: 'That is not a timezone we know.' }
  if (!Number.isInteger(input.week_start) || input.week_start < 0 || input.week_start > 6) {
    return { ok: false, error: 'The week has to start on a day of the week.' }
  }
  if (input.import_cutoff_date && !/^\d{4}-\d{2}-\d{2}$/.test(input.import_cutoff_date)) {
    return { ok: false, error: 'The cutoff has to be a date.' }
  }

  // A cutoff in the past would stop the import before days that QuickBooks Time
  // still owns, and the gap would show up as months that stop reconciling with
  // no explanation on screen.
  if (input.import_cutoff_date && input.import_cutoff_date < new Date().toISOString().slice(0, 10)) {
    return { ok: false, error: 'A cutoff in the past would leave a gap between the two systems. Use today or later.' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('tc_settings').update({
    timezone: input.timezone,
    week_start: input.week_start,
    import_cutoff_date: input.import_cutoff_date,
    updated_at: new Date().toISOString(),
  }).eq('singleton_id', 1)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/clocky-hours')
  revalidatePath('/hours')
  return { ok: true }
}
