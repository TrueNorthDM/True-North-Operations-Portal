import { describe, it, expect } from 'vitest'

import { groupCodesByProject } from './manual-data'

/**
 * The order of this list is the whole point of grouping it: the headings are
 * only correct while a project's codes stay adjacent, because the menu draws a
 * heading wherever the group changes rather than sorting anything itself.
 */
describe('groupCodesByProject', () => {
  it('reads each code’s project from its prefix', () => {
    const out = groupCodesByProject(['BE-MKTG', 'i7-ADMIN', 'MME-ADMIN', 'WM-MKTG'])
    expect(out.map(c => c.project)).toEqual([
      'i7 Marketing', 'Moisture Meters (MME)', 'Wagner Meters (WM)', 'Bessemeter',
    ])
  })

  it('keeps a project’s codes adjacent, in the report’s group order', () => {
    const out = groupCodesByProject(['WM-MKTG', 'BE-ADMIN', 'i7-MKTG', 'BE-MKTG'])
    expect(out.map(c => c.code)).toEqual(['i7-MKTG', 'WM-MKTG', 'BE-ADMIN', 'BE-MKTG'])
  })

  // The defect that started this: ASCII order put every lower-case code after
  // every upper-case one, so i7-ADMIN sat below WMW-MKTG.
  it('sorts within a group ignoring case', () => {
    const out = groupCodesByProject(['i7-MKTG', 'i7-ADMIN'])
    expect(out.map(c => c.code)).toEqual(['i7-ADMIN', 'i7-MKTG'])
  })

  it('sends an unrecognised prefix to Unassigned, last', () => {
    const out = groupCodesByProject(['ZZ-THING', 'BE-MKTG'])
    expect(out.map(c => c.project)).toEqual(['Bessemeter', 'Unassigned'])
  })

  it('holds no code back', () => {
    const codes = ['BE-MKTG', 'i7-ADMIN', 'ZZ-ODD', '1 None']
    expect(groupCodesByProject(codes)).toHaveLength(codes.length)
  })
})
