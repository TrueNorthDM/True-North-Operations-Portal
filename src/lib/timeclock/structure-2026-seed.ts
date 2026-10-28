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

/**
 * The "When to use" line under each client, division and project (the clock
 * panel, Add time and "Which job?"), written from David's document
 * (Time-Tracking Structure, section 4). One plain line each, 400 characters at most.
 */
const WHEN: Record<string, string> = {
  'i7 Marketing': 'Work billed to i7. Pick the brand\'s division, then its i7 code.',
  'COE Group': 'Work for GNA, DDI, COE and COEI, and the clients COEI bills (Grants Pass, NAD) and its events.',
  'True North Internal': 'True North\'s own overhead: never invoiced to a client.',
  'Wagner Meters': 'Wagner Meters work: WM, WMFL, WMFP or WMW, each with its marketing, web development or admin code.',
  'Bessemeter': 'Bessemeter work: BE-MKTG, BE-WEBDVT or BE-ADMIN.',
  'Moisture Meters': 'MME codes: the separate Moisture Meters block of the i7 report and invoice.',
  'Seeker Outreach': 'Work that reaches people who are seeking: AAAF and the content made for it.',
  'Education': 'The Digital Evangelism Academy: course development, platform engagement and promotion.',
  'Sharing Tools': 'Tools for sharing the message: the Ask A Friend QR cards and the mobile sharing app.',
  'Fundraising': 'Everything that raises funds: system build, list building, donor journey, campaigns, church presentations and the newsletter.',
  'Trust & Authority': 'Building COE\'s trust: the COE website, the trust portfolio, networking and content syndication.',
  'Africa': 'Africa\'s projects; one-off Africa tasks go to Africa Small Projects.',
  'Client: Grants Pass': 'Grants Pass work billed through COEI: the church and the school.',
  'Client: NAD': 'Work for NAD, a denominational client billed through COEI.',
  'Event: ASI': 'Preparing for, travelling to, attending and following up the ASI event.',
  'AAAF': 'Includes companion content: infographics, videos, study guides.',
  'Digital Evangelism Academy': 'Course development, platform engagement and promotion of the Academy.',
  'Ask A Friend QR Cards': 'The QR cards, including their design and print materials.',
  'Mobile Sharing App': 'The mobile sharing app.',
  'System Build': 'Building the fundraising system: forms, CRM and automations.',
  'List Building': 'Growing the donor list.',
  'Donor Relations/Journey': 'Donor stewardship and the donor journey.',
  'Campaign Development': 'Developing and promoting fundraising campaigns.',
  'Church Presentations': 'Preparing and giving church presentations.',
  'Newsletter': 'The fundraising newsletter.',
  'COE Website': 'Static pages and thought leadership on the COE website.',
  'Trust Portfolio': 'The trust portfolio.',
  'Networking: Centers of Influence': 'Networking with centers of influence, including networking events.',
  'Content Syndication': 'Distributing content from AAAF, COE thought leadership and the Trust Portfolio.',
  'Public University Outreach': 'Outreach at public universities, including presentations and training there.',
  'HopeFor.Africa': 'The HopeFor.Africa project. Translation goes here too: write the language in Notes.',
  'Africa Social Media': 'Social media for Africa: posting and community engagement.',
  'Africa Events': 'Africa\'s events: preparing, travelling, attending and following up.',
  'Africa Small Projects': 'Africa\'s one-off tasks. A task that grows becomes its own project.',
  'Africa Admin/Exec': 'The Africa exec and admin team\'s work, and True North staff support for it, such as the Africa team\'s payroll. Billable to COE.',
  'GP Church': 'Grants Pass church work.',
  'GP School': 'Grants Pass school work.',
  'NAD General': 'Work for NAD that spans several things.',
  'ASI General': 'Work for the ASI event.',
  'TN Website': 'Work on True North\'s own website.',
  'TN Operations': 'Payroll, finance, HR and general administration not tied to a client.',
  'TN General': 'Leadership, individual status meetings, team-wide meetings, internal training.',
}

/** "X General": work that spans several projects of its division, such as a multi-project meeting. */
const GENERAL = /^(.+) General$/

/** The i7 codes: -MKTG marketing, -WEBDVT web development, -ADMIN admin. */
function i7Line(name: string): string | null {
  const m = /^(.+)-(MKTG|WEBDVT|ADMIN)$/.exec(name)
  if (!m) return null
  const what = m[2] === 'MKTG' ? 'Marketing' : m[2] === 'WEBDVT' ? 'Web development' : 'Admin: reports, invoices and client email'
  return `${what} for ${m[1]}. A meeting covering several brands goes under the one code it is billed to, with the brands in Notes.`
}

/** The line for a client, division or project name; null when there is none to write. */
export function whenToUse(name: string): string | null {
  return WHEN[name] ?? i7Line(name) ?? (GENERAL.test(name) && name !== 'General' ? `Work that spans several ${GENERAL.exec(name)![1]} projects, such as a meeting about all of them.` : null)
}

type Row = { id: number; parent_id: number | null; name: string; when_to_use?: string | null }

export interface SeedResult { added: number; kept: number; activitiesAdded: number }

export async function seedStructure2026(c: Db): Promise<SeedResult> {
  const { data, error } = await c.from('tc_jobcodes').select('id, parent_id, name, when_to_use').eq('structure', 2)
  if (error) throw new Error(`The 2026 structure could not be read: ${error.message}`)
  const have = (data ?? []) as Row[]
  const find = (parent: number | null, name: string) => have.find(r => r.parent_id === parent && r.name.toLowerCase() === name.toLowerCase())
  let added = 0, kept = 0, order = 0

  const put = async (parent: number | null, name: string, level: 'client' | 'division' | 'project', billable: boolean): Promise<number> => {
    order += 10
    const there = find(parent, name)
    if (there) {
      kept++
      // A line nobody has written yet is filled in; one already there (or edited in the catalogue) is left alone.
      const line = whenToUse(name)
      if (!there.when_to_use && line) {
        const { error: e } = await c.from('tc_jobcodes').update({ when_to_use: line }).eq('id', there.id)
        if (e) throw new Error(`The line for "${name}" could not be saved: ${e.message}`)
      }
      return there.id
    }
    const { data: row, error: e } = await c.from('tc_jobcodes').insert({
      name, parent_id: parent, structure: 2, level, kind: 'regular', billable, active: true,
      folder: level !== 'project', sort_order: order, when_to_use: whenToUse(name),
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
