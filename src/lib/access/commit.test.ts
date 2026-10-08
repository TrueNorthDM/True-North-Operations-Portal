import { describe, it, expect } from 'vitest'
import { commitAccess } from './log'

/** A client that answers the one RPC commitAccess makes, and records what it sent. */
function fakeDb(answer: { data?: unknown; error?: { message: string } | null }) {
  const sent: { fn: string; args: Record<string, unknown> }[] = []
  return { db: { rpc: async (fn: string, args: Record<string, unknown>) => { sent.push({ fn, args }); return { data: answer.data ?? null, error: answer.error ?? null } } } as never, sent }
}

const log = { actorId: 'p1', kind: 'rules' as const, summary: 's', reason: 'because of x', changes: [] }

describe('commitAccess (one transaction for a change and its log row)', () => {
  it('sends the operations, what they were based on, and the log row together', async () => {
    const { db, sent } = fakeDb({ data: 42 })
    const res = await commitAccess(db, [{ op: 'rule_set', level: 'admin', key: 'report', allowed: true }], { rules: [{ level: 'admin', key: 'report', allowed: false }] }, log)
    expect(res).toEqual({ ok: true, id: 42 })
    expect(sent[0].fn).toBe('access_commit')
    expect(sent[0].args.p_expected).toEqual({ rules: [{ level: 'admin', key: 'report', allowed: false }] })
    expect((sent[0].args.p_log as { actor_id: string }).actor_id).toBe('p1')
  })

  it('explains a change made since the page was opened, in words', async () => {
    const { db } = fakeDb({ error: { message: 'access_changed_since' } })
    const res = await commitAccess(db, [], {}, log)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/changed this since you opened the page/)
  })

  it('names the two Super Admins rule and an undo already done', async () => {
    for (const [code, words] of [['at_least_two_super_admins', /at least two Super Admins/], ['access_already_undone', /already undone/]] as const) {
      const { db } = fakeDb({ error: { message: `ERROR: ${code}` } })
      const res = await commitAccess(db, [], {}, log)
      if (!res.ok) expect(res.error).toMatch(words)
    }
  })

  it('never shows a raw database message', async () => {
    const { db } = fakeDb({ error: { message: 'insert or update on table "access_tool_teams" violates foreign key constraint' } })
    const res = await commitAccess(db, [], {}, log)
    if (!res.ok) expect(res.error).toBe('The change could not be saved. Nothing was changed; try again.')
  })
})
