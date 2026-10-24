/**
 * The QuickBooks Time custom fields a hand-added entry fills in.
 *
 * Three of them are known by their TSheets id in i7report.ts, because the
 * reports already read them. Two more, "1 Company" and "4 Billable", were never
 * read by anything until the entry form started reproducing the whole shape, so
 * their ids are not written down anywhere here.
 *
 * They are resolved by NAME rather than guessed. An id guessed wrong writes the
 * value under some other field's key, which nothing rejects and no screen shows:
 * it would surface months later as a report that cannot find hours it holds. A
 * rename in TSheets makes the lookup miss and the field simply not appear, which
 * is the failure worth having.
 */

import type { Db } from '@/lib/supabase/types'
import { I7_CODE_CF, ACTIVITY_CF, PROJECT_CF } from '@/lib/tsheets/i7report'

type Client = Db

export const COMPANY_FIELD_NAME = '1 Company'
export const BILLABLE_FIELD_NAME = '4 Billable'

/** `fields` keys, as the JSONB on tc_entries stores them: tc_fields.id as text. */
export interface EntryFieldKeys {
  code: string | null       // 1 - i7 Code
  activity: string | null   // 3 Activity
  project: string | null    // 2 Project
  company: string | null    // 1 Company
  billable: string | null   // 4 Billable
}

export async function loadEntryFieldKeys(supabase: Client): Promise<EntryFieldKeys> {
  const { data, error } = await supabase.from('tc_fields').select('id, external_id, name')
  // Unread is not "no fields": every entry would be saved and shown without its custom fields.
  if (error) throw new Error(`The entry fields could not be read: ${error.message}`)
  const rows = (data ?? []) as { id: number; external_id: number | null; name: string }[]

  const byExternal = (ext: string) => {
    const f = rows.find(r => String(r.external_id) === ext)
    return f ? String(f.id) : null
  }
  const byName = (name: string) => {
    const f = rows.find(r => r.name.trim().toLowerCase() === name.toLowerCase())
    return f ? String(f.id) : null
  }

  return {
    code: byExternal(I7_CODE_CF),
    activity: byExternal(ACTIVITY_CF),
    project: byExternal(PROJECT_CF),
    company: byName(COMPANY_FIELD_NAME),
    billable: byName(BILLABLE_FIELD_NAME),
  }
}

/**
 * The values a list field offers, in the order TSheets shows them.
 *
 * Read from tc_field_options rather than from what has been logged, unlike the
 * i7 codes and activities: those two are long and drift, so "what people
 * actually use" is the useful list. Company and Billable are short, closed, and
 * every value is meant to be on offer, including one nobody has picked yet.
 */
export async function loadFieldOptions(supabase: Client, fieldId: string | null): Promise<string[]> {
  if (!fieldId) return []
  const { data, error } = await supabase
    .from('tc_field_options')
    .select('label, position')
    .eq('field_id', Number(fieldId))
    .eq('active', true)
    .order('position')
    .order('label')
  if (error) throw new Error(`The field's options could not be read: ${error.message}`)
  return ((data ?? []) as { label: string }[]).map(o => o.label)
}
