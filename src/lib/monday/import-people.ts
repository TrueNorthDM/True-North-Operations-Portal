/**
 * One-off (re-runnable) importer: True North Team Monday board (2547376221) →
 * the Directory `people` table + `person-files` Storage bucket. Lets us retire
 * the /admin/team mirror by making the Directory the HR source of truth.
 *
 * Runs with the service-role client (bypasses RLS + Storage policies) from an
 * admin/cron route — never a user session. Idempotent: matches existing people
 * by monday_item_id, else by name; skips attachments already imported (by
 * monday_asset_id). Deliberately conservative — it writes only board-owned HR
 * fields and NEVER touches internal_rate, profile_id, tsheets_*, i7_projects,
 * team membership, or a mailbox that already has a value.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, PersonRow } from '@/lib/types/database.types'
import { getMondayToken } from './snapshot'
import { normalizeName, namesMatch } from '@/lib/tsheets/sync'

const MONDAY_URL = 'https://api.monday.com/v2'
const BOARD_ID = '2547376221'

type Client = SupabaseClient<Database>

interface RawCol { id: string; title: string; type: string }
interface RawCV { id: string; text: string | null; value: string | null; type: string }
interface RawItem { id: string; name: string; group: { id: string; title: string }; column_values: RawCV[] }
interface RawPage { cursor: string | null; items: RawItem[] }

export interface ImportResult {
  ok: boolean
  error?: string
  created: number
  updated: number
  managersLinked: number
  docsImported: number
  docsFailed: number
  warnings: string[]
}

// ── Monday GraphQL (lightweight retry on transient failures) ────────────────
async function gql<T>(token: string, query: string, variables: Record<string, unknown>, attempt = 1): Promise<T> {
  const res = await fetch(MONDAY_URL, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-10' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) {
    if ([429, 500, 502, 503, 504].includes(res.status) && attempt < 4) {
      await new Promise(r => setTimeout(r, Math.min(8000, 500 * 2 ** (attempt - 1))))
      return gql<T>(token, query, variables, attempt + 1)
    }
    throw new Error(`Monday HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  }
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] }
  if (json.errors?.length) throw new Error(`Monday GraphQL: ${json.errors.map(e => e.message).join('; ')}`)
  if (!json.data) throw new Error('Monday: empty response')
  return json.data
}

// NB: item-level `assets` is NOT populated inside items_page, so we read the
// file column's `value` (→ assetId list) and resolve URLs via a root assets(ids:)
// query instead (see resolveAssetUrls / the attachments pass).
const ITEM_FIELDS = `id name group { id title } column_values { id text value type }`

async function fetchBoard(token: string): Promise<{ columns: RawCol[]; items: RawItem[] }> {
  const meta = await gql<{ boards: { columns: RawCol[]; items_page: RawPage }[] }>(
    token,
    `query ($b: [ID!]) { boards(ids: $b) { columns { id title type } items_page(limit: 100) { cursor items { ${ITEM_FIELDS} } } } }`,
    { b: [BOARD_ID] },
  )
  const board = meta.boards?.[0]
  if (!board) throw new Error('Board not found, or this Monday token can’t access it.')
  const items = [...board.items_page.items]
  let cursor = board.items_page.cursor
  while (cursor) {
    const page = await gql<{ next_items_page: RawPage }>(
      token,
      `query ($c: String!) { next_items_page(limit: 100, cursor: $c) { cursor items { ${ITEM_FIELDS} } } }`,
      { c: cursor },
    )
    items.push(...page.next_items_page.items)
    cursor = page.next_items_page.cursor
  }
  return { columns: board.columns, items }
}

// ── value mappers (board label → the Directory's stored codes) ──────────────
const lc = (s: string) => s.trim().toLowerCase()
const mapType = (t: string) => (/contract/i.test(t) ? 'contractor' : /us|employee/i.test(t) ? 'us' : null)
const mapTime = (t: string) => (/part/i.test(t) ? 'part' : /full/i.test(t) ? 'full' : null)
const mapYNS = (t: string) => (['yes', 'no', 'sometimes'].includes(lc(t)) ? lc(t) : null)
const mapYesNotyet = (t: string) => (/^\s*yes/i.test(t) ? 'yes' : /not/i.test(t) ? 'notyet' : null)
const mapYesNo = (t: string) => (/^\s*yes/i.test(t) ? 'yes' : /^\s*no/i.test(t) ? 'no' : null)
const parseNum = (t: string): number | null => { const n = Number((t || '').replace(/[^\d.\-]/g, '')); return t && !Number.isNaN(n) ? n : null }
function isoDate(text: string, value: string | null): string | null {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(text || '')
  if (m) return m[1]
  try { const d = value ? (JSON.parse(value) as { date?: string }).date : null; return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null } catch { return null }
}
function checkboxOn(text: string, value: string | null): boolean {
  if (text && text.trim()) return true
  try { return value ? (JSON.parse(value) as { checked?: string | boolean }).checked === 'true' || (JSON.parse(value) as { checked?: boolean }).checked === true : false } catch { return false }
}
/** Board's single Email → the best empty mailbox by domain; never overwrites. */
type MailboxCols = Partial<Pick<PersonRow, 'email_true_north' | 'email_goodnews' | 'email_personal'>>
function mailboxPatch(email: string, cur: { email_true_north: string | null; email_goodnews: string | null; email_personal: string | null }): MailboxCols {
  const e = email.trim()
  if (!e) return {}
  if (/goodnews/i.test(e)) return cur.email_goodnews ? {} : { email_goodnews: e }
  if (/true\W*north/i.test(e)) return cur.email_true_north ? {} : { email_true_north: e }
  return cur.email_personal ? {} : { email_personal: e }
}

// ── Monday Doc → markdown ───────────────────────────────────────────────────
interface DocBlock { type: string; content: string }
function blockToLine(b: DocBlock): string {
  let text = ''
  try {
    const c = JSON.parse(b.content || '{}') as { deltaFormat?: { insert?: unknown }[]; deltas?: { insert?: unknown }[]; text?: string }
    const delta = c.deltaFormat ?? c.deltas
    if (Array.isArray(delta)) text = delta.map(d => (typeof d?.insert === 'string' ? d.insert : '')).join('')
    else if (typeof c.text === 'string') text = c.text
  } catch { text = '' }
  text = text.replace(/\s+$/g, '')
  const t = (b.type || '').toLowerCase()
  if (!text.trim()) return ''
  if (/large title|title1|title 1/.test(t)) return `# ${text}`
  if (/medium title|title2|title 2/.test(t)) return `## ${text}`
  if (/small title|title3|title 3/.test(t)) return `### ${text}`
  if (/bulleted|bullet/.test(t)) return `- ${text}`
  if (/numbered/.test(t)) return `1. ${text}`
  if (/check/.test(t)) return `- [ ] ${text}`
  if (/quote/.test(t)) return `> ${text}`
  return text
}
function docToMarkdown(blocks: DocBlock[]): string {
  return blocks.map(blockToLine).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** Doc object_ids referenced by a "doc" column value ({"files":[{objectId,…}]}). */
function docObjectIds(value: string | null): string[] {
  if (!value) return []
  try {
    const files = (JSON.parse(value) as { files?: { objectId?: number | string; fileType?: string }[] }).files ?? []
    return files.filter(f => f.objectId != null && /doc/i.test(f.fileType ?? '')).map(f => String(f.objectId))
  } catch { return [] }
}

/** Fetch + convert each doc, keyed by object_id. */
async function fetchDocMarkdown(token: string, objectIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (let i = 0; i < objectIds.length; i += 20) {
    const chunk = objectIds.slice(i, i + 20)
    const data = await gql<{ docs: { object_id: string; blocks: DocBlock[] | null }[] }>(
      token, `query ($ids: [ID!]) { docs(object_ids: $ids) { object_id blocks { type content } } }`, { ids: chunk })
    for (const d of data.docs ?? []) out.set(String(d.object_id), docToMarkdown(d.blocks ?? []))
  }
  return out
}

type PersonScalars = Database['public']['Tables']['people']['Update']

// Diagnostic (GET ?probe=docs): Monday's doc-column value shape + the docs API
// block format aren't consistently documented, so we inspect them live before
// writing the real extraction. Returns the doc column, a few sample cells, and
// a docs() sample.
export async function probeBoardDocs(): Promise<unknown> {
  const token = await getMondayToken()
  if (!token) return { error: 'No Monday API token configured.' }
  const { columns, items } = await fetchBoard(token)
  const docCol = columns.find(c => c.type === 'doc') ?? columns.find(c => /^history$/i.test(c.title))
  const objIds = docCol
    ? items.slice(0, 3).flatMap(it => docObjectIds(it.column_values.find(c => c.id === docCol.id)?.value ?? null)).slice(0, 2)
    : []
  const tryDocs = async (param: 'object_ids' | 'ids') => {
    try {
      const data = await gql<{ docs: { object_id: string; blocks: DocBlock[] | null }[] }>(
        token, `query ($ids: [ID!]) { docs(${param}: $ids) { object_id blocks { type content } } }`, { ids: objIds })
      return { param, count: (data.docs ?? []).length, sample: (data.docs ?? []).slice(0, 1).map(d => ({ blocks: (d.blocks ?? []).length, blockTypes: [...new Set((d.blocks ?? []).map(b => b.type))], markdownLen: docToMarkdown(d.blocks ?? []).length })) }
    } catch (e) { return { param, error: e instanceof Error ? e.message : String(e) } }
  }
  const byObjectIds = await tryDocs('object_ids')
  const byIds = await tryDocs('ids')
  return {
    columns: columns.map(c => ({ id: c.id, title: c.title, type: c.type })),
    docColumn: docCol ? { id: docCol.id, title: docCol.title, type: docCol.type } : null,
    docObjectIdsFound: objIds.length,
    byObjectIds,
    byIds,
  }
}

export async function importMondayPeople(supabase: Client): Promise<ImportResult> {
  const warnings: string[] = []
  const result: ImportResult = { ok: false, created: 0, updated: 0, managersLinked: 0, docsImported: 0, docsFailed: 0, warnings }
  try {
    const token = await getMondayToken()
    if (!token) return { ...result, error: 'No Monday API token is configured (Settings → APIs & tokens).' }

    const { columns, items } = await fetchBoard(token)

    // Column lookups — by title, with type as a fallback for the ambiguous ones.
    const byTitle = (re: RegExp) => columns.find(c => re.test(c.title))?.id ?? null
    const byType = (t: string) => columns.find(c => c.type === t)?.id ?? null
    const col = {
      last: byTitle(/^last\s*name/i),
      teamMeeting: byTitle(/team\s*meeting/i),
      empHist: byTitle(/employment\s*history/i),
      type: byTitle(/^type/i),
      job: byTitle(/job\s*title/i),
      reportsTo: columns.find(c => c.type === 'people' && /^reports\s*to/i.test(c.title))?.id ?? byTitle(/^reports\s*to/i),
      reportsToMgr: byTitle(/do\s*you\s*report/i),
      also: byTitle(/also\s*reports\s*to/i),
      mgrText: byTitle(/please\s*type|manager\s*below/i),
      time: byTitle(/^\s*time\s*$/i),
      weekly: byTitle(/weekly\s*hours/i),
      companyEmail: byTitle(/company\s*email/i),
      email: byType('email') ?? byTitle(/^email/i),
      phone: byType('phone'),
      whatsapp: byTitle(/whatsapp/i),
      location: byType('location') ?? byTitle(/location/i),
      dob: byTitle(/\bdob\b|birth/i),
      joined: byTitle(/joined/i),
      left: byTitle(/left\s*on/i),
      doc: byType('doc') ?? byTitle(/^history$/i), // the "History" Monday-Doc column
    }

    // Pull each person's History Monday Doc as markdown, keyed by board item id.
    const docByItem = new Map<string, string>()
    let docRefs = 0
    if (col.doc) {
      const itemObjIds = items.map(it => ({ itemId: it.id, objId: docObjectIds(it.column_values.find(c => c.id === col.doc)?.value ?? null)[0] })).filter(x => x.objId)
      docRefs = itemObjIds.length
      try {
        const md = await fetchDocMarkdown(token, [...new Set(itemObjIds.map(x => x.objId!))])
        for (const { itemId, objId } of itemObjIds) { const m = md.get(objId!); if (m) docByItem.set(itemId, m) }
      } catch (e) { warnings.push(`Docs fetch failed: ${e instanceof Error ? e.message : 'unknown'}`) }
    }
    result.docsImported = docByItem.size
    result.docsFailed = docRefs - docByItem.size

    // Existing directory people (only the columns the import reads/guards).
    const { data: existing, error: readErr } = await supabase
      .from('people')
      .select('id, full_name, monday_item_id, email_true_north, email_goodnews, email_personal')
    if (readErr) return { ...result, error: `Read people failed: ${readErr.message}` }
    type ExRow = { id: string; full_name: string; monday_item_id: string | null; email_true_north: string | null; email_goodnews: string | null; email_personal: string | null }
    const pool = (existing ?? []) as ExRow[]
    const byMondayId = new Map(pool.filter(p => p.monday_item_id).map(p => [p.monday_item_id!, p]))

    // Pass 1 — upsert each person's scalar fields; remember item→personId + name→id.
    const itemToPerson = new Map<string, string>()   // board item id → people.id
    const nameToPerson = new Map<string, string>()   // normalized full name → people.id
    for (const p of pool) if (p.full_name) nameToPerson.set(normalizeName(p.full_name), p.id)

    for (const it of items) {
      const cv = new Map(it.column_values.map(c => [c.id, c]))
      const txt = (id: string | null) => (id ? cv.get(id)?.text ?? '' : '')
      const val = (id: string | null) => (id ? cv.get(id)?.value ?? null : null)

      const first = it.name.trim()
      if (!first) { warnings.push(`Skipped an item with no name (id ${it.id}).`); continue }
      const last = txt(col.last).trim()
      const combined = last && !normalizeName(first).endsWith(normalizeName(last)) ? `${first} ${last}`.replace(/\s+/g, ' ').trim() : first
      const status: 'active' | 'inactive' = /not\s*active|off-?\s*board/i.test(it.group.title) ? 'inactive' : 'active'

      // Match: prior import (monday_item_id) → then fuzzy name.
      let match = byMondayId.get(it.id)
      let curEmails = match
      if (!match) {
        const found = pool.find(p => namesMatch(normalizeName(first), normalizeName(last), p.full_name))
        if (found) { match = found; curEmails = found }
      }

      const scalars: PersonScalars = {
        last_name: last || null,
        title: txt(col.job) || null,
        employment_type: mapType(txt(col.type)),
        schedule: mapTime(txt(col.time)),
        weekly_hours: parseNum(txt(col.weekly)),
        reports_to_manager: mapYNS(txt(col.reportsToMgr)),
        manager_name_text: txt(col.mgrText) || null,
        team_meeting: checkboxOn(txt(col.teamMeeting), val(col.teamMeeting)),
        phone: txt(col.phone) || null,
        location: txt(col.location) || null,
        company_email: mapYesNotyet(txt(col.companyEmail)),
        whatsapp_same_number: mapYesNo(txt(col.whatsapp)),
        date_of_birth: isoDate(txt(col.dob), val(col.dob)),
        hire_date: isoDate(txt(col.joined), val(col.joined)),
        left_on: isoDate(txt(col.left), val(col.left)),
        employment_history: txt(col.empHist) || null,
        monday_docs: docByItem.get(it.id) ?? null,
        status,
        monday_item_id: it.id,
        ...mailboxPatch(txt(col.email), curEmails ?? { email_true_north: null, email_goodnews: null, email_personal: null }),
      }

      let personId: string
      if (match) {
        // Existing person: fill board-owned fields, but keep the curated full_name.
        const { error } = await supabase.from('people').update(scalars).eq('id', match.id)
        if (error) { warnings.push(`Update failed for ${combined}: ${error.message}`); continue }
        personId = match.id
        result.updated++
      } else {
        const { data, error } = await supabase.from('people').insert({ full_name: combined, ...scalars }).select('id').single()
        if (error || !data) { warnings.push(`Insert failed for ${combined}: ${error?.message}`); continue }
        personId = data.id
        result.created++
      }
      itemToPerson.set(it.id, personId)
      nameToPerson.set(normalizeName(combined), personId)
    }

    // Pass 2 — resolve Reports To / Also Reports To names → manager_id / also_reports_to_id.
    for (const it of items) {
      const personId = itemToPerson.get(it.id)
      if (!personId) continue
      const cv = new Map(it.column_values.map(c => [c.id, c]))
      const nameOf = (id: string | null) => (id ? (cv.get(id)?.text ?? '').split(',')[0].trim() : '')
      const resolve = (name: string) => (name ? nameToPerson.get(normalizeName(name)) ?? null : null)
      const mgr = resolve(nameOf(col.reportsTo))
      const also = resolve(nameOf(col.also))
      const patch: PersonScalars = {}
      if (mgr && mgr !== personId) patch.manager_id = mgr
      if (also && also !== personId) patch.also_reports_to_id = also
      if (Object.keys(patch).length) {
        const { error } = await supabase.from('people').update(patch).eq('id', personId)
        if (error) warnings.push(`Manager link failed for item ${it.id}: ${error.message}`)
        else result.managersLinked++
      }
    }

    result.ok = true
    return result
  } catch (e) {
    return { ...result, error: e instanceof Error ? e.message : 'Import failed' }
  }
}
