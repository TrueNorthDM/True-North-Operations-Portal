/**
 * Puts the 2026 job structure (structure-2026.ts) into tc_jobcodes and
 * tc_fields as structure 2: clients and divisions as folders, projects as the
 * jobs people clock into, and the 26 activities as one field with families.
 *
 * Safe to run again: what is already there (same name in the same place) is
 * kept, anything missing is added, nothing is deleted or renamed. The job
 * catalogue is where people change the lists afterwards.
 */

import type { Db } from '@/lib/supabase/types'
import { ACTIVITIES, STRUCTURE } from './structure-2026'

export const ACTIVITY_2026_FIELD = 'Activity'

/** What a client or a division covers, shown under it in the clock and the catalogue. */
const WHEN: Record<string, string> = {
  'i7 Marketing': 'Work billed to i7. Pick the division of the brand, then its i7 code.',
  'COE Group': 'Work for GNA, DDI, COE and COEI, and the clients COEI bills (Grants Pass, NAD) and its events.',
  'True North Internal': 'True North\'s own overhead: never invoiced to a client.',
  'Moisture Meters': 'MME codes: the separate Moisture Meters block of the i7 report and invoice.',
  'Africa': 'Africa\'s projects; one-off Africa tasks go to Africa Small Projects.',
  'TN General': 'Leadership, individual status meetings, team-wide meetings, internal training.',
  'TN Operations': 'Payroll, finance, HR and general administration not tied to a client.',
  'TN Website': 'Work on True North\'s own website.',
  'AAAF': 'Includes companion content: infographics, videos, study guides.',
  'Africa Small Projects': 'Africa\'s one-off tasks. A task that grows becomes its own project.',
  'Content Syndication': 'Distributing content from AAAF, COE thought leadership and the Trust Portfolio.',
}

type Row = { id: number; parent_id: number | null; name: string }

export interface SeedResult { added: number; kept: number; activitiesAdded: number }

export async function seedStructure2026(c: Db): Promise<SeedResult> {
  const { data, error } = await c.from('tc_jobcodes').select('id, parent_id, name').eq('structure', 2)
  if (error) throw new Error(`The 2026 structure could not be read: ${error.message}`)
  const have = (data ?? []) as Row[]
  const find = (parent: number | null, name: string) => have.find(r => r.parent_id === parent && r.name.toLowerCase() === name.toLowerCase())
  let added = 0, kept = 0, order = 0

  const put = async (parent: number | null, name: string, level: 'client' | 'division' | 'project', billable: boolean): Promise<number> => {
    order += 10
    const there = find(parent, name)
    if (there) { kept++; return there.id }
    const { data: row, error: e } = await c.from('tc_jobcodes').insert({
      name, parent_id: parent, structure: 2, level, kind: 'regular', billable, active: true,
      folder: level !== 'project', sort_order: order, when_to_use: WHEN[name] ?? null,
      edited_in_portal_at: new Date().toISOString(),
    }).select('id, parent_id, name').single()
    if (e || !row) throw new Error(`"${name}" could not be added: ${e?.message ?? 'no row'}`)
    have.push(row as Row)
    added++
    return (row as Row).id
  }

  for (const client of STRUCTURE) {
    const cid = await put(null, client.name, 'client', client.billable)
    for (const d of client.divisions) {
      const did = await put(cid, d.name, 'division', client.billable)
      for (const p of d.projects) await put(did, p.name, 'project', client.billable)
    }
    for (const p of client.projects) await put(cid, p.name, 'project', client.billable)
  }

  // The 2026 Activity field and its 26 values, grouped by family.
  const { data: f, error: fe } = await c.from('tc_fields').select('id').eq('structure', 2).eq('name', ACTIVITY_2026_FIELD).maybeSingle()
  if (fe) throw new Error(`The 2026 Activity field could not be read: ${fe.message}`)
  let fieldId = (f as { id: number } | null)?.id
  if (!fieldId) {
    const { data: nf, error: ne } = await c.from('tc_fields').insert({ name: ACTIVITY_2026_FIELD, structure: 2, required: true, active: true, position: 0 }).select('id').single()
    if (ne || !nf) throw new Error(`The 2026 Activity field could not be added: ${ne?.message ?? 'no row'}`)
    fieldId = (nf as { id: number }).id
  }
  const { data: opts, error: oe } = await c.from('tc_field_options').select('label').eq('field_id', fieldId)
  if (oe) throw new Error(`The 2026 activities could not be read: ${oe.message}`)
  const labels = new Set(((opts ?? []) as { label: string }[]).map(o => o.label.toLowerCase()))
  const missing = ACTIVITIES.map((a, i) => ({ a, i })).filter(({ a }) => !labels.has(a.name.toLowerCase()))
  if (missing.length) {
    const { error: ie } = await c.from('tc_field_options').insert(missing.map(({ a, i }) => ({
      field_id: fieldId, label: a.name, family: a.family, position: (i + 1) * 10, active: true, edited_in_portal_at: new Date().toISOString(),
    })))
    if (ie) throw new Error(`The 2026 activities could not be added: ${ie.message}`)
  }
  return { added, kept, activitiesAdded: missing.length }
}
