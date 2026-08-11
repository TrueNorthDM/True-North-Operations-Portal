/**
 * GET /api/admin/tsheets-inventory, a read-only survey of the QuickBooks Time
 * account, for designing the portal's own time clock.
 *
 * Why a route and not a script: the token lives in app_settings and nowhere
 * else, and it should stay there. Running the survey here keeps it server-side,
 * inside the same trust boundary as the sync that already uses it, instead of
 * copying a credential onto somebody's laptop to look at an account.
 *
 * Every call it makes is a GET. It writes nothing, to TSheets or to us.
 *
 * Admin only, and deliberately plain text: this output is read by a person
 * deciding what to build, not consumed by a screen.
 *
 * Parts, because the whole thing does not fit in one function invocation:
 *   ?part=overview (default)  account, settings, groups, custom fields
 *   ?part=users               everyone, active and not, with approval state
 *   ?part=jobcodes            the full tree, including what was deactivated
 *   ?part=history             which years have entries at all (cheap probe)
 *   ?part=year&year=2024      the real entry count for one year, plus a sample
 */

import { isSecurityAdmin } from '@/lib/auth/role'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadI7EntriesHere } from '@/lib/timeclock/report-source'
import { loadGrantPassData } from '@/lib/timeclock/grant-pass'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const BASE = 'https://rest.tsheets.com/api/v1'

type Json = Record<string, unknown>

export async function GET(request: Request) {
  if (!(await isSecurityAdmin())) {
    return new Response('Admins only.', { status: 403 })
  }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('app_settings')
    .select('tsheets_api_token')
    .eq('singleton_id', 1)
    .maybeSingle()
  const token = (data as { tsheets_api_token?: string | null } | null)?.tsheets_api_token
  if (!token) return new Response('No TSheets token configured.', { status: 500 })

  const url = new URL(request.url)
  const part = url.searchParams.get('part') ?? 'overview'
  const year = Number(url.searchParams.get('year') ?? '0')

  const out: string[] = []
  const say = (s = '') => out.push(s)
  const head = (t: string) => { say(); say('='.repeat(72)); say(t); say('='.repeat(72)) }
  let calls = 0

  async function get(path: string, params: Record<string, string> = {}): Promise<Json> {
    const qs = new URLSearchParams(params).toString()
    const res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    calls++
    if (!res.ok) return { __error: `${res.status} ${res.statusText}` }
    return res.json() as Promise<Json>
  }

  // Walks every page of a list endpoint. `pick` pulls the one collection we
  // want out of the results envelope, which TSheets keys by object type.
  async function getAll(path: string, params: Record<string, string>, key: string): Promise<Json[]> {
    const all: Json[] = []
    for (let page = 1; page < 300; page++) {
      const r = await get(path, { ...params, page: String(page), per_page: '200' })
      if (r.__error) { all.push(r); break }
      const results = (r.results ?? {}) as Record<string, Record<string, Json>>
      all.push(...Object.values(results[key] ?? {}))
      if (!r.more) break
    }
    return all
  }

  if (part === 'overview') {
    head('ACCOUNT')
    const me = await get('/current_user')
    const meUser = Object.values(((me.results ?? {}) as Record<string, Record<string, Json>>).users ?? {})[0] ?? {}
    say(JSON.stringify({ company: meUser.company_name, client_url: meUser.client_url, my_id: meUser.id }, null, 1))

    head('WHAT THIS ACCOUNT HAS (last_modified_timestamps)')
    const lm = await get('/last_modified_timestamps')
    say(JSON.stringify(((lm.results ?? {}) as Json).last_modified_timestamps ?? lm, null, 1))

    head('COMPANY SETTINGS, the rules our settings page has to reproduce')
    const eff = await get('/effective_settings')
    const groups = (((eff.results ?? {}) as Json).effective_settings ?? {}) as Record<string, unknown>
    for (const [name, vals] of Object.entries(groups)) {
      say(`\n--- ${name} ---`)
      say(JSON.stringify(vals, null, 1).slice(0, 4000))
    }

    head('GROUPS')
    const gs = await getAll('/groups', { active: 'both' }, 'groups')
    for (const g of gs) say(`  ${String(g.name).padEnd(30)} id=${g.id}  active=${g.active}  managers=${JSON.stringify(g.manager_ids)}`)

    head('CUSTOM FIELDS')
    const fields = await getAll('/customfields', { active: 'both' }, 'customfields')
    for (const f of fields) {
      say(`  ${String(f.name).padEnd(24)} id=${f.id}  type=${f.type}  applies_to=${f.applies_to}  required=${f.required}  active=${f.active}  ui=${f.ui_preference}`)
    }
    // One call per field: /customfielditems answers 404 unless it is told which
    // field to list, which is why asking for all of them at once came back empty.
    for (const f of fields) {
      const items = await getAll('/customfielditems', { customfield_id: String(f.id), active: 'both' }, 'customfielditems')
      const names = items
        .filter(i => !i.__error)
        .map(i => `${i.name}${i.active === false ? ' (off)' : ''}`)
        .sort()
      say(`\n  ${f.name}, ${names.length} values:`)
      say(names.length ? '    ' + names.join(' · ') : `    ${JSON.stringify(items[0] ?? {})}`)
    }

    head('TIME OFF')
    say(JSON.stringify(await get('/timeoff_requests', { per_page: '5' })).slice(0, 1500))

    head('SCHEDULING')
    say(JSON.stringify(await get('/schedule_calendars', { per_page: '10' })).slice(0, 1000))
  }

  if (part === 'users') {
    head('USERS')
    const users = await getAll('/users', { active: 'both' }, 'users')
    const active = users.filter(u => u.active)
    say(`${users.length} total, ${active.length} active, ${users.length - active.length} inactive`)
    say('\nfields on a user record:')
    say(Object.keys(users[0] ?? {}).join(', '))
    say('\nactive, with approval state:')
    for (const u of active) {
      say(`  ${`${u.first_name} ${u.last_name}`.padEnd(26)} id=${String(u.id).padEnd(9)} submitted_to=${u.submitted_to || '-'}  approved_to=${u.approved_to || '-'}  group=${u.group_id}  manager_of=${JSON.stringify(u.manager_of_group_ids)}  payroll_id=${u.payroll_id || '-'}  hire=${u.hire_date || '-'}`)
    }
    say('\ninactive, whose history still has to come across:')
    for (const u of users.filter(x => !x.active)) {
      say(`  ${`${u.first_name} ${u.last_name}`.padEnd(26)} id=${String(u.id).padEnd(9)} term=${u.term_date || '-'}  last_modified=${u.last_modified}`)
    }
  }

  if (part === 'jobcodes') {
    head('JOBCODES, active and inactive, every type')
    const jcs = await getAll('/jobcodes', { active: 'both', type: 'all' }, 'jobcodes')
    const byType: Record<string, number> = {}
    for (const j of jcs) byType[String(j.type)] = (byType[String(j.type)] ?? 0) + 1
    say(`${jcs.length} total  ${JSON.stringify(byType)}`)
    say(`active ${jcs.filter(j => j.active).length}, inactive ${jcs.filter(j => !j.active).length}`)

    const kids = new Map<string, Json[]>()
    for (const j of jcs) {
      const p = String(j.parent_id)
      kids.set(p, [...(kids.get(p) ?? []), j])
    }
    say('\ntree, × marks what is deactivated (invisible to the current sync):')
    const walk = (parent: string, depth: number) => {
      for (const j of (kids.get(parent) ?? []).sort((a, b) => String(a.name).localeCompare(String(b.name)))) {
        say(`${'  '.repeat(depth)}${j.active ? ' ' : '×'} ${j.name}  [id ${j.id}, ${j.type}${j.billable ? ', billable' : ''}]`)
        walk(String(j.id), depth + 1)
      }
    }
    walk('0', 0)
  }

  if (part === 'history') {
    head('WHICH YEARS HAVE ENTRIES')
    const now = new Date().getUTCFullYear()
    for (let y = 2012; y <= now; y++) {
      const r = await get('/timesheets', { start_date: `${y}-01-01`, end_date: `${y}-12-31`, per_page: '1', page: '1' })
      const results = (r.results ?? {}) as Record<string, Record<string, Json>>
      const n = Object.keys(results.timesheets ?? {}).length
      say(`  ${y}: ${n > 0 ? 'has entries' : '-'}${r.__error ? ` ERROR ${r.__error}` : ''}`)
    }
    say('\nThen call ?part=year&year=YYYY for the real count of a year.')
  }

  if (part === 'year' && year) {
    head(`TIMESHEETS ${year}`)
    let count = 0
    let sample: Json | null = null
    const byType: Record<string, number> = {}
    for (let page = 1; page < 500; page++) {
      const r = await get('/timesheets', { start_date: `${year}-01-01`, end_date: `${year}-12-31`, per_page: '200', page: String(page) })
      if (r.__error) { say(`ERROR ${r.__error}`); break }
      const results = (r.results ?? {}) as Record<string, Record<string, Json>>
      const items = Object.values(results.timesheets ?? {})
      for (const t of items) byType[String(t.type)] = (byType[String(t.type)] ?? 0) + 1
      if (!sample && items.length) sample = items[0]
      count += items.length
      if (!r.more) break
    }
    say(`${count.toLocaleString()} entries  ${JSON.stringify(byType)}`)
    if (sample) {
      say('\nfields on a timesheet record:')
      say(Object.keys(sample).join(', '))
      say('\none record, to see the shape:')
      say(JSON.stringify(sample, null, 1).slice(0, 2000))
    }
  }

  // Why a month does not reconcile. Compares OUR stored rows against a fresh
  // pull, entry by entry, and prints only the ones that disagree.
  if (part === 'compare' && url.searchParams.get('month')) {
    const month = url.searchParams.get('month')!
    const [y, m] = month.split('-').map(Number)
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
    head(`COMPARE ${month}`)

    const source = await getAll('/timesheets', { start_date: `${month}-01`, end_date: end }, 'timesheets')

    const mine = new Map<number, number>()
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from('tc_entries')
        .select('external_id, duration_seconds')
        .eq('source', 'tsheets').gte('entry_date', `${month}-01`).lte('entry_date', end)
        .range(from, from + 999)
      const rows = (data ?? []) as { external_id: number | null; duration_seconds: number }[]
      for (const r of rows) if (r.external_id != null) mine.set(r.external_id, r.duration_seconds)
      if (rows.length < 1000) break
    }

    const seen = new Map<number, number>()
    let dupes = 0
    for (const t of source) {
      const id = Number(t.id)
      if (seen.has(id)) dupes++
      seen.set(id, Number(t.duration ?? 0))
    }

    say(`source rows returned ${source.length}, distinct ids ${seen.size}, repeats within the pull ${dupes}`)
    say(`stored here ${mine.size}`)
    say(`source seconds (as summed by the import) ${source.reduce((acc: number, t) => acc + Number(t.duration ?? 0), 0)}`)
    say(`source seconds (distinct ids only)      ${[...seen.values()].reduce((s, v) => s + v, 0)}`)
    say(`stored seconds                          ${[...mine.values()].reduce((s, v) => s + v, 0)}`)

    say('\nids in the pull but not stored here:')
    const missing = [...seen.keys()].filter(id => !mine.has(id))
    say(missing.length ? missing.join(', ') : '  none')

    say('\nstored with a different duration:')
    const differing = [...seen.entries()].filter(([id, d]) => mine.has(id) && mine.get(id) !== d)
    say(differing.length
      ? differing.map(([id, d]) => `  ${id}: source ${d}s, here ${mine.get(id)}s`).join('\n')
      : '  none')

    say('\nstored here but not in the pull:')
    const extra = [...mine.keys()].filter(id => !seen.has(id))
    say(extra.length ? extra.join(', ') : '  none')
  }

  // Which parameter combinations /timesheets actually accepts. Written because
  // the delta answered 417 and every explanation for it was a guess.
  if (part === 'probe') {
    head('WHICH TIMESHEET QUERIES ARE ACCEPTED')
    const since = url.searchParams.get('since') ?? '2026-08-01T00:00:00+00:00'
    const tries: [string, Record<string, string>][] = [
      ['one month, no watermark', { start_date: '2026-08-01', end_date: '2026-08-31' }],
      ['one month + modified_since', { start_date: '2026-08-01', end_date: '2026-08-31', modified_since: since }],
      ['one year + modified_since', { start_date: '2026-01-01', end_date: '2026-12-31', modified_since: since }],
      ['modified_since alone', { modified_since: since }],
      ['one month + modified_since + per_page', { start_date: '2026-08-01', end_date: '2026-08-31', modified_since: since, per_page: '200' }],
      ['one year, no watermark', { start_date: '2026-01-01', end_date: '2026-12-31' }],
      ['ten years, no watermark', { start_date: '2017-01-01', end_date: '2026-12-31' }],
    ]
    for (const [label, params] of tries) {
      const r = await get('/timesheets', { ...params, page: '1' })
      const results = (r.results ?? {}) as Record<string, Record<string, Json>>
      const n = Object.keys(results.timesheets ?? {}).length
      say(`  ${label.padEnd(38)} ${r.__error ? `ERROR ${r.__error}` : `ok, ${n} rows, more=${r.more}`}`)
    }
    say('\nSame query, different shapes of the same instant:')
    const shapes: [string, string][] = [
      ['clean, +00:00', '2026-08-01T00:00:00+00:00'],
      ['milliseconds + Z', '2026-08-01T00:00:00.000Z'],
      ['microseconds + 00 (what Postgres returns)', '2026-08-01T00:00:00.123456+00:00'],
      ['seconds + Z', '2026-08-01T00:00:00Z'],
      ['date only', '2026-08-01'],
    ]
    for (const [label, value] of shapes) {
      const r = await get('/timesheets', { start_date: '2026-08-01', end_date: '2026-08-31', modified_since: value, page: '1' })
      say(`  ${label.padEnd(42)} ${r.__error ? `ERROR ${r.__error}` : 'ok'}`)
    }

    say('\nAnd the deleted list, which the delta also needs:')
    const d = await get('/timesheets_deleted', { modified_since: since, page: '1' })
    say(`  timesheets_deleted + modified_since    ${d.__error ? `ERROR ${d.__error}` : 'ok'}`)
  }

  // What a PTO balance actually looks like on a user, before building anything
  // that reads one.
  if (part === 'pto') {
    head('PTO BALANCES, as the account holds them')
    const users = await getAll('/users', { active: 'yes' }, 'users')
    const withBalances = users.filter(u => u.pto_balances && Object.keys(u.pto_balances as object).length)
    say(`${withBalances.length} of ${users.length} active users carry a balance\n`)
    for (const u of withBalances.slice(0, 8)) {
      say(`  ${`${u.first_name} ${u.last_name}`.padEnd(24)} ${JSON.stringify(u.pto_balances)}`)
    }
    say('\nthe raw shape of one:')
    say(JSON.stringify(withBalances[0]?.pto_balances ?? users[0]?.pto_balances ?? null, null, 1))
    say('\nkeys seen across everyone (these should be jobcode ids):')
    const keys = new Set<string>()
    for (const u of users) for (const k of Object.keys((u.pto_balances ?? {}) as object)) keys.add(k)
    say('  ' + ([...keys].join(', ') || 'none'))
  }

  // The old cache against the new source, for one month, before the report is
  // pointed at the second one. Same discipline as the import reconciliation:
  // a swap you cannot check is a swap you have to trust.
  if (part === 'report' && url.searchParams.get('month')) {
    const month = url.searchParams.get('month')!
    const [y, m] = month.split('-').map(Number)
    const start = `${month}-01`
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
    head(`REPORT SOURCES, ${month}`)

    type Row = { user_id: number; duration: number; date: string; i7Code: string; activity: string }
    const cached: Row[] = []
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase
        .from('tsheets_timesheets').select('user_id, duration, date, i7_code, activity')
        .gte('date', start).lte('date', end).order('id', { ascending: true }).range(from, from + 999)
      const rows = (data ?? []) as { user_id: number; duration: number; date: string; i7_code: string | null; activity: string | null }[]
      for (const r of rows) cached.push({ user_id: r.user_id, duration: r.duration, date: r.date, i7Code: r.i7_code ?? '', activity: r.activity ?? '' })
      if (rows.length < 1000) break
    }
    const fresh = await loadI7EntriesHere(supabase, start, end)

    const sum = (rows: Row[]) => rows.reduce((a, r) => a + r.duration, 0)
    say(`old cache : ${cached.length} entries, ${sum(cached)} seconds`)
    say(`clocky    : ${fresh.length} entries, ${sum(fresh)} seconds`)

    // Compared as buckets rather than row by row: the two have no shared id, and
    // what the report actually renders is the bucket, not the row.
    const key = (r: Row) => `${r.date}|${r.user_id}|${r.i7Code}|${r.activity}`
    const bucket = (rows: Row[]) => {
      const m = new Map<string, number>()
      for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + r.duration)
      return m
    }
    const a = bucket(cached), b = bucket(fresh)
    const keys = new Set([...a.keys(), ...b.keys()])
    const off = [...keys].filter(k => (a.get(k) ?? 0) !== (b.get(k) ?? 0))
    say(`\n${keys.size} buckets (day + person + code + activity), ${off.length} disagree`)
    for (const k of off.slice(0, 25)) {
      say(`  ${k}  old ${a.get(k) ?? 0}s  clocky ${b.get(k) ?? 0}s`)
    }
    if (off.length > 25) say(`  ... and ${off.length - 25} more`)

    // Equal totals with unequal row counts is the case a value comparison
    // cannot see: two buckets holding zero seconds each look identical whether
    // one of them exists or not. Named explicitly so it cannot pass as a match.
    say(`\nzero-second rows: old ${cached.filter(r => !r.duration).length}, clocky ${fresh.filter(r => !r.duration).length}`)
    const onlyOld = [...a.keys()].filter(k => !b.has(k))
    const onlyNew = [...b.keys()].filter(k => !a.has(k))
    say(`buckets only in the old cache: ${onlyOld.length}`)
    for (const k of onlyOld.slice(0, 10)) say(`  ${k}  ${a.get(k)}s`)
    say(`buckets only in clocky: ${onlyNew.length}`)
    for (const k of onlyNew.slice(0, 10)) say(`  ${k}  ${b.get(k)}s`)
  }

  // Grant Pass is identifiable two ways: the "2 Project" field carries
  // 'GP School' / 'GP church', and there are deactivated job codes of the same
  // names with children. Which one people actually use, and when, decides what
  // the report means. Counting beats choosing.
  if (part === 'grantpass') {
    head('GRANT PASS, HOW IT IS TAGGED')

    const { data: fieldRows } = await supabase
      .from('tc_fields').select('id, external_id, name')
    const fields = (fieldRows ?? []) as { id: number; external_id: number | null; name: string }[]
    const projectField = fields.find(f => String(f.external_id) === '129636')
    say(`the "2 Project" field is tc_fields id ${projectField?.id ?? 'MISSING'}`)

    const { data: jcRows } = await supabase
      .from('tc_jobcodes').select('id, name, parent_id, active, external_id')
    const jcs = (jcRows ?? []) as { id: number; name: string; parent_id: number | null; active: boolean; external_id: number | null }[]
    const roots = jcs.filter(j => /^GP (Church|School)$/i.test(j.name))
    say(`\njob codes named GP Church / GP School: ${roots.length}`)
    const gpIds = new Set<number>()
    for (const r of roots) {
      gpIds.add(r.id)
      say(`  ${r.name} (id ${r.id}, external ${r.external_id}, active=${r.active})`)
      for (const c of jcs.filter(j => j.parent_id === r.id)) {
        gpIds.add(c.id)
        say(`    - ${c.name} (id ${c.id}, active=${c.active})`)
      }
    }

    const key = projectField ? String(projectField.id) : null
    const byYear = new Map<string, { field: number; jobcode: number; both: number; fieldSecs: number; jobcodeSecs: number }>()
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase
        .from('tc_entries').select('entry_date, jobcode_id, duration_seconds, fields')
        .order('id', { ascending: true }).range(from, from + 999)
      const rows = (data ?? []) as { entry_date: string; jobcode_id: number | null; duration_seconds: number; fields: Record<string, string> | null }[]
      for (const r of rows) {
        const value = key ? (r.fields ?? {})[key] ?? '' : ''
        const byField = /^gp (school|church)$/i.test(value.trim())
        const byJobcode = r.jobcode_id != null && gpIds.has(r.jobcode_id)
        if (!byField && !byJobcode) continue
        const y = r.entry_date.slice(0, 4)
        const cur = byYear.get(y) ?? { field: 0, jobcode: 0, both: 0, fieldSecs: 0, jobcodeSecs: 0 }
        if (byField) { cur.field++; cur.fieldSecs += r.duration_seconds }
        if (byJobcode) { cur.jobcode++; cur.jobcodeSecs += r.duration_seconds }
        if (byField && byJobcode) cur.both++
        byYear.set(y, cur)
      }
      if (rows.length < 1000) break
    }

    say('\nyear   by "2 Project"      by job code         both')
    for (const y of [...byYear.keys()].sort()) {
      const c = byYear.get(y)!
      say(`  ${y}  ${String(c.field).padStart(5)} (${(c.fieldSecs/3600).toFixed(0).padStart(5)} h)  ${String(c.jobcode).padStart(5)} (${(c.jobcodeSecs/3600).toFixed(0).padStart(5)} h)  ${String(c.both).padStart(5)}`)
    }

    // Which exact values appear in the field, spelling included: 'GP church' is
    // lowercase in the option list and that is easy to miss.
    if (key) {
      const seen = new Map<string, number>()
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from('tc_entries').select('fields').order('id', { ascending: true }).range(from, from + 999)
        const rows = (data ?? []) as { fields: Record<string, string> | null }[]
        for (const r of rows) {
          const v = ((r.fields ?? {})[key] ?? '').trim()
          if (/gp/i.test(v)) seen.set(v, (seen.get(v) ?? 0) + 1)
        }
        if (rows.length < 1000) break
      }
      say('\nexact values seen containing "gp":')
      for (const [v, n] of seen) say(`  '${v}' × ${n}`)
    }
  }

  // The loader itself, with its error in words. The page shows "Something went
  // wrong" and a reference number, which is right for a person and useless for
  // fixing it.
  if (part === 'gpdata') {
    head('GRANT PASS LOADER')
    // Run it exactly as the page does, on the caller's own client, because the
    // only difference between this working here and failing there is RLS.
    try {
      const asMe = await createClient()
      const t1 = Date.now()
      const d1 = await loadGrantPassData(asMe)
      say(`as the signed-in user: ok in ${Date.now() - t1}ms, ${d1.entries} entries`)
    } catch (e) {
      say('as the signed-in user: FAILED')
      say(e instanceof Error ? `${e.name}: ${e.message}` : String(e))
    }
    try {
      const t0 = Date.now()
      const d = await loadGrantPassData(supabase)
      say(`ok in ${Date.now() - t0}ms`)
      say(`${d.entries} entries, school ${(d.totalSchool / 3600).toFixed(2)} h, church ${(d.totalChurch / 3600).toFixed(2)} h`)
      say(`${d.months.length} months, ${d.firstMonth} to ${d.lastMonth}`)
      say(`people: ${d.byPerson.map(p => p.label).join(', ')}`)
    } catch (e) {
      say('FAILED')
      say(e instanceof Error ? `${e.name}: ${e.message}` : String(e))
      if (e instanceof Error && e.stack) say(e.stack.split('\n').slice(0, 6).join('\n'))
    }
  }

  say(`\n\n${calls} API calls, all GET.`)
  return new Response(out.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
