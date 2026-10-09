/**
 * An in-memory stand-in for the Supabase client, for the People and
 * notification tests (audit, 8 and 9 October 2026). It answers the query
 * shapes that code uses: select with filters (eq, neq, in, is, lt, lte, gt,
 * gte, not is null, or), order and range, embeds such as `teams(name)`,
 * counts, insert (refused on a repeated unique key), upsert, update, delete,
 * rpc and storage removes, and records every write so a test can say what
 * was changed.
 *
 * Not a database: rows come back whole (a select's column list only decides
 * the embeds), which is enough for code that reads named fields.
 */

type Row = Record<string, unknown>
type Pred = (r: Row) => boolean

export interface FakeOptions {
  /** Tables whose reads and writes fail, as a lost connection would. */
  fail?: string[]
  /** An rpc that fails, with this message. */
  rpcError?: string
  /** What an rpc answers, by function name (null when absent). */
  rpc?: Record<string, (args: Record<string, unknown>) => unknown>
  /** Unique keys per table: an insert repeating one fails, as Postgres would. */
  unique?: Record<string, string[]>
  /** A write containing a row this matches fails whole (a bad row in a batch). */
  rejectRow?: (table: string, row: Row) => boolean
}

export interface Fake {
  db: never
  tables: Record<string, Row[]>
  writes: { op: 'insert' | 'update' | 'delete'; table: string; rows: Row[] }[]
  rpcs: { fn: string; args: unknown }[]
  removed: { bucket: string; paths: string[] }[]
  /** Every table read, in order. */
  reads: string[]
}

// The foreign key an embed follows: `teams(name)` on team_members is team_id.
const FK: Record<string, string> = { people: 'person_id', teams: 'team_id' }

function orPred(expr: string): Pred {
  const parts = expr.split(',').map(p => {
    const [col, op, ...rest] = p.split('.')
    const v = rest.join('.')
    if (op === 'is' && v === 'null') return (r: Row) => r[col] == null
    if (op === 'eq') return (r: Row) => String(r[col] ?? '') === v
    if (op === 'neq') return (r: Row) => String(r[col] ?? '') !== v
    throw new Error(`fake db: unsupported or() part ${p}`)
  })
  return r => parts.some(f => f(r))
}

export function fakeDb(seed: Record<string, Row[]>, opts: FakeOptions = {}): Fake {
  const tables: Record<string, Row[]> = Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, v.map(r => ({ ...r }))]))
  const fake: Fake = { db: undefined as never, tables, writes: [], rpcs: [], removed: [], reads: [] }
  let nextId = 1

  function from(table: string) {
    const preds: Pred[] = []
    let op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
    let upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {}
    let range: [number, number] | null = null
    let payload: Row | Row[] | null = null
    let columns = '*'
    let count = false
    let head = false
    let one: 'single' | 'maybe' | null = null
    let limit: number | null = null
    let returning = false

    const q = {
      select(cols = '*', o?: { count?: string; head?: boolean }) {
        if (op === 'select') columns = cols
        else returning = true
        if (o?.count) count = true
        if (o?.head) head = true
        return q
      },
      insert(rows: Row | Row[]) { op = 'insert'; payload = rows; return q },
      upsert(rows: Row | Row[], o: { onConflict?: string; ignoreDuplicates?: boolean } = {}) { op = 'upsert'; payload = rows; upsertOpts = o; return q },
      update(patch: Row, o?: { count?: string }) { op = 'update'; payload = patch; if (o?.count) count = true; return q },
      delete() { op = 'delete'; return q },
      eq(col: string, v: unknown) { preds.push(r => r[col] === v); return q },
      neq(col: string, v: unknown) { preds.push(r => r[col] !== v); return q },
      in(col: string, vs: unknown[]) { preds.push(r => vs.includes(r[col])); return q },
      is(col: string, v: unknown) { preds.push(r => (v === null ? r[col] == null : r[col] === v)); return q },
      lt(col: string, v: string) { preds.push(r => r[col] != null && String(r[col]) < v); return q },
      lte(col: string, v: string) { preds.push(r => r[col] != null && String(r[col]) <= v); return q },
      gt(col: string, v: string) { preds.push(r => r[col] != null && String(r[col]) > v); return q },
      gte(col: string, v: string) { preds.push(r => r[col] != null && String(r[col]) >= v); return q },
      range(from: number, to: number) { range = [from, to]; return q },
      not(col: string, o: string, v: unknown) {
        if (o !== 'is' || v !== null) throw new Error('fake db: only not(col, "is", null)')
        preds.push(r => r[col] != null)
        return q
      },
      or(expr: string) { preds.push(orPred(expr)); return q },
      order() { return q },
      limit(n: number) { limit = n; return q },
      maybeSingle() { one = 'maybe'; return q },
      single() { one = 'single'; return q },
      then<A, B>(ok: (v: unknown) => A, ko?: (e: unknown) => B) {
        return Promise.resolve(run()).then(ok, ko)
      },
    }

    function run() {
      if (opts.fail?.includes(table)) return { data: null, error: { message: 'boom' }, count: null }
      const rows = (tables[table] ??= [])
      const hit = (r: Row) => preds.every(p => p(r))
      const incoming = Array.isArray(payload) ? payload : payload ? [payload] : []
      if (op !== 'select' && op !== 'delete' && opts.rejectRow && incoming.some(r => opts.rejectRow!(table, r))) {
        return { data: null, error: { message: 'row refused' }, count: null }
      }
      const sameKey = (a: Row, b: Row, cols: string[]) => cols.every(c => a[c] === b[c])

      if (op === 'upsert') {
        const cols = (upsertOpts.onConflict ?? 'id').split(',').map(c => c.trim())
        const written: Row[] = []
        for (const r of incoming) {
          const there = rows.find(x => sameKey(x, r, cols))
          if (there) { if (!upsertOpts.ignoreDuplicates) { Object.assign(there, r); written.push({ ...there }) } }
          else { const row = { id: `new-${nextId++}`, ...r }; rows.push(row); written.push(row) }
        }
        fake.writes.push({ op: 'insert', table, rows: written })
        return { data: null, error: null }
      }

      if (op === 'insert') {
        const keys = opts.unique?.[table]
        if (keys && incoming.some(r => rows.some(x => sameKey(x, r, keys)))) {
          // As Postgres says it: code 23505, the index named in the message.
          return { data: null, error: { code: '23505', message: `duplicate key value violates unique constraint "${table}_${keys.join('_')}"` } }
        }
        const added = incoming.map(r => ({ id: `new-${nextId++}`, ...r }))
        rows.push(...added)
        fake.writes.push({ op, table, rows: added })
        const data = returning ? (one ? added[0] : added) : null
        return { data, error: null }
      }
      if (op === 'update') {
        const changed = rows.filter(hit)
        for (const r of changed) Object.assign(r, payload)
        fake.writes.push({ op, table, rows: changed.map(r => ({ ...r })) })
        return { data: returning ? changed.map(r => ({ ...r })) : null, error: null, count: count ? changed.length : null }
      }
      if (op === 'delete') {
        const gone = rows.filter(hit)
        tables[table] = rows.filter(r => !hit(r))
        fake.writes.push({ op, table, rows: gone })
        return { data: returning ? gone : null, error: null }
      }

      fake.reads.push(table)
      let out = rows.filter(hit).map(r => ({ ...r }))
      for (const m of columns.matchAll(/(\w+)(!inner)?\(([^)]*)\)/g)) {
        const [, embed, inner] = m
        const fk = FK[embed]
        if (!fk) throw new Error(`fake db: no foreign key for ${embed}`)
        out = out
          .map(r => ({ ...r, [embed]: (tables[embed] ?? []).find(x => x.id === r[fk]) ?? null }))
          .filter(r => !inner || r[embed] !== null)
      }
      if (range) out = out.slice(range[0], range[1] + 1)
      if (limit != null) out = out.slice(0, limit)
      const n = out.length
      if (one === 'single' && n !== 1) return { data: null, error: { message: 'not one row' } }
      const data = head ? null : one ? out[0] ?? null : out
      return { data, error: null, count: count ? n : null }
    }

    return q
  }

  fake.db = {
    from,
    rpc: async (fn: string, args: unknown) => {
      fake.rpcs.push({ fn, args })
      if (opts.rpcError) return { data: null, error: { message: opts.rpcError } }
      return { data: opts.rpc?.[fn]?.(args as Record<string, unknown>) ?? null, error: null }
    },
    storage: {
      from: (bucket: string) => ({
        remove: async (paths: string[]) => { fake.removed.push({ bucket, paths }); return { data: null, error: null } },
      }),
    },
  } as never
  return fake
}
