/**
 * A small in-memory stand-in for the Supabase client, for the reimbursement
 * tests (approvals/actions.test.ts, requests/reimbursements/*.test.ts). Only
 * what those code paths use: select / update / insert / delete with eq, in,
 * is, gte, lte (string compare: dates), not-is-null, order, limit, single and maybeSingle. `or()` filters
 * nothing. `before` runs before each query (a concurrent edit, a failure).
 * Test support only: never imported by the app.
 */

type Row = Record<string, unknown>
export type Op = 'select' | 'update' | 'insert' | 'delete'
export interface Query { table: string; op: Op; patch?: Row; rows?: Row[] }
export type Before = (q: Query, db: Record<string, Row[]>) => { message: string } | void

const same = (a: unknown, b: unknown) => (a == null || b == null ? a == b : String(a) === String(b))

class Q implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
  op: Op | null = null
  patch?: Row
  inserted?: Row[]
  filters: ((r: Row) => boolean)[] = []
  returns = false
  one: 'single' | 'maybe' | null = null
  max = Infinity
  constructor(private db: Record<string, Row[]>, private table: string, private before: Before | undefined, private log: Query[]) {}
  select() { if (!this.op) this.op = 'select'; else this.returns = true; return this }
  update(patch: Row) { this.op = 'update'; this.patch = patch; return this }
  insert(rows: Row | Row[]) { this.op = 'insert'; this.inserted = Array.isArray(rows) ? rows : [rows]; return this }
  delete() { this.op = 'delete'; return this }
  eq(c: string, v: unknown) { this.filters.push(r => same(r[c], v)); return this }
  neq(c: string, v: unknown) { this.filters.push(r => !same(r[c], v)); return this }
  in(c: string, vs: unknown[]) { this.filters.push(r => vs.some(v => same(r[c], v))); return this }
  is(c: string, v: null) { this.filters.push(r => r[c] == v); return this }
  gte(c: string, v: string | number) { this.filters.push(r => r[c] != null && String(r[c]) >= String(v)); return this }
  lte(c: string, v: string | number) { this.filters.push(r => r[c] != null && String(r[c]) <= String(v)); return this }
  not(c: string, _op: string, _v: null) { this.filters.push(r => r[c] != null); return this }
  or() { return this }
  order() { return this }
  range() { return this }
  limit(n: number) { this.max = n; return this }
  single() { this.one = 'single'; return this }
  maybeSingle() { this.one = 'maybe'; return this }
  then<A, B>(ok?: ((v: { data: unknown; error: { message: string } | null }) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve(this.run()).then(ok, bad)
  }
  private run(): { data: unknown; error: { message: string } | null } {
    const op = this.op ?? 'select'
    const q: Query = { table: this.table, op, patch: this.patch, rows: this.inserted }
    this.log.push(q)
    const err = this.before?.(q, this.db)
    if (err) return { data: null, error: err }
    const all = (this.db[this.table] ??= [])
    const hit = () => all.filter(r => this.filters.every(f => f(r))).slice(0, this.max)
    let out: Row[] | null = null
    if (op === 'select') out = hit().map(r => ({ ...r }))
    if (op === 'update') { const m = hit(); for (const r of m) Object.assign(r, this.patch); out = this.returns ? m.map(r => ({ ...r })) : null }
    if (op === 'delete') { const m = hit(); this.db[this.table] = all.filter(r => !m.includes(r)); out = this.returns ? m.map(r => ({ ...r })) : null }
    if (op === 'insert') {
      const made: Row[] = []
      for (const r of this.inserted!) {
        const row = { id: all.reduce((n, x) => Math.max(n, Number(x.id) || 0), 0) + 1, ...r }
        all.push(row)
        made.push(row)
      }
      out = this.returns ? made.map(r => ({ ...r })) : null
    }
    if (this.one) {
      const first = out?.[0] ?? null
      if (!first && this.one === 'single') return { data: null, error: { message: 'no row' } }
      return { data: first, error: null }
    }
    return { data: out, error: null }
  }
}

export function fakeDb(db: Record<string, Row[]>, before?: Before) {
  const log: Query[] = []
  return {
    db, log,
    client: {
      from: (table: string) => new Q(db, table, before, log),
      rpc: async () => ({ data: 'RMB-2026-0001', error: null }),
    },
  }
}
