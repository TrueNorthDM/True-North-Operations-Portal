import { describe, it, expect } from 'vitest'
import { effectiveManagers } from './managers'

const p = (id: string, manager_id: string | null) => ({ id, manager_id })
const all = () => true

describe('who each person hangs under on the org chart', () => {
  it('keeps a plain reporting line', () => {
    const eff = effectiveManagers([p('ceo', null), p('ana', 'ceo')], all)
    expect(eff.get('ana')).toBe('ceo')
    expect(eff.get('ceo')).toBeNull()
  })

  it('puts someone whose manager is not on the chart at the top', () => {
    const eff = effectiveManagers([p('ana', 'gone')], id => id !== 'gone')
    expect(eff.get('ana')).toBeNull()
  })

  // Without the cut, a loop has no root and everyone in it disappears.
  it('cuts a loop so nobody in it vanishes', () => {
    const people = [p('a', 'b'), p('b', 'c'), p('c', 'a'), p('d', 'a')]
    const eff = effectiveManagers(people, all)
    const roots = people.filter(x => eff.get(x.id) == null)
    expect(roots).toHaveLength(1)
    // Every person reaches that root by following the chain.
    for (const x of people) {
      let cur: string | null = x.id
      const seen = new Set<string>()
      while (cur && eff.get(cur)) { expect(seen.has(cur)).toBe(false); seen.add(cur); cur = eff.get(cur)! }
      expect(cur).toBe(roots[0].id)
    }
  })

  it('cuts someone set as their own manager', () => {
    expect(effectiveManagers([p('a', 'a')], all).get('a')).toBeNull()
  })
})
