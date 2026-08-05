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
    const items = await getAll('/customfielditems', { active: 'both' }, 'customfielditems')
    const byField = new Map<string, string[]>()
    for (const i of items) {
      const k = String(i.customfield_id)
      byField.set(k, [...(byField.get(k) ?? []), `${i.name}${i.active ? '' : ' (inactive)'}`])
    }
    for (const [id, names] of byField) {
      const f = fields.find(x => String(x.id) === id)
      say(`\n  ${f?.name ?? id}, ${names.length} values:`)
      say('    ' + names.sort().join(' · '))
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

  say(`\n\n${calls} API calls, all GET.`)
  return new Response(out.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
