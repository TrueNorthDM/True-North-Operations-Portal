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
const PERIODS = new Set(['monthly', 'semimonthly', 'biweekly', 'weekly'])
const DIRECTIONS = new Set(['nearest', 'up', 'down'])

export async function saveRules(input: Rules): Promise<Result> {
  if (!(await allowedTo('ck-rules'))) return { ok: false, error: 'Only an admin can change the rules.' }

  // Each of these is also a CHECK in migration 057. Repeating them here is not
  // redundancy for its own sake: the database refuses with a constraint name,
  // and a person changing a setting deserves a sentence.
  if (!ZONES.has(input.timezone)) return { ok: false, error: 'That is not a timezone we know.' }
  if (!PERIODS.has(input.period_type)) return { ok: false, error: 'That is not a pay period we support.' }
  if (!DIRECTIONS.has(input.round_direction)) return { ok: false, error: 'Rounding goes to the nearest, up, or down.' }
  if (!Number.isInteger(input.week_start) || input.week_start < 0 || input.week_start > 6) {
    return { ok: false, error: 'The week has to start on a day of the week.' }
  }
  if (!Number.isFinite(input.round_minutes) || input.round_minutes < 1 || input.round_minutes > 60) {
    return { ok: false, error: 'Round to between 1 and 60 minutes.' }
  }
  if (input.auto_clockout_hours !== null &&
      (!Number.isFinite(input.auto_clockout_hours) || input.auto_clockout_hours < 1 || input.auto_clockout_hours > 24)) {
    return { ok: false, error: 'Auto clock-out has to be between 1 and 24 hours, or empty for never.' }
  }
  if (input.daily_regular_hours < 0 || input.daily_regular_hours > 24) {
    return { ok: false, error: 'A day does not hold that many hours.' }
  }
  if (input.weekly_regular_hours < 0 || input.weekly_regular_hours > 168) {
    return { ok: false, error: 'A week does not hold that many hours.' }
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
    period_type: input.period_type,
    round_enabled: input.round_enabled,
    round_minutes: input.round_minutes,
    round_direction: input.round_direction,
    auto_clockout_hours: input.auto_clockout_hours,
    split_at_midnight: input.split_at_midnight,
    calculate_overtime: input.calculate_overtime,
    daily_regular_hours: input.daily_regular_hours,
    weekly_regular_hours: input.weekly_regular_hours,
    import_cutoff_date: input.import_cutoff_date,
    updated_at: new Date().toISOString(),
  }).eq('singleton_id', 1)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/clocky-hours')
  revalidatePath('/hours')
  return { ok: true }
}
