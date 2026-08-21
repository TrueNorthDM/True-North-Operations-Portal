import { describe, expect, it } from 'vitest'
import { colourOf, teamColour, teamColoursFrom } from './team-colour'
import { TEAM_COLOR } from './people-types'

describe('teamColour', () => {
  // The database is the one an admin can change, and a colour picker that
  // changes nothing on most screens is the worse defect.
  it('takes what the admin set', () => {
    expect(teamColour('#F4C24A', 'SEO Strategists')).toBe('#F4C24A')
  })

  it('falls back to the key map when no colour is set', () => {
    expect(teamColour(null, 'SEO Strategists')).toBe(TEAM_COLOR.seo)
    expect(teamColour('   ', 'Writers')).toBe(TEAM_COLOR.writing)
  })

  // teamKeyFromName collapses seven teams into five keys, so several teams
  // share a fallback. That is exactly why the fallback cannot be the source.
  it('gives teams with no key of their own the same fallback', () => {
    expect(teamColour(null, 'Africa Team')).toBe(TEAM_COLOR.other)
    expect(teamColour(null, 'Philippines Team')).toBe(TEAM_COLOR.other)
  })

  it('has an answer for somebody on no team at all', () => {
    expect(teamColour(null, null)).toBe(TEAM_COLOR.other)
  })
})

describe('teamColoursFrom and colourOf', () => {
  const colours = teamColoursFrom([
    { name: 'SEO Strategists', color: '#F4C24A' },
    { name: 'Writers', color: null },
  ])

  it('carries the set colour through', () => {
    expect(colourOf(colours, 'SEO Strategists')).toBe('#F4C24A')
  })

  it('falls back for a team with none set', () => {
    expect(colourOf(colours, 'Writers')).toBe(TEAM_COLOR.writing)
  })

  it('falls back the same way for a team it has never heard of', () => {
    expect(colourOf(colours, 'Brand new team')).toBe(TEAM_COLOR.other)
  })

  it('does not throw for nobody', () => {
    expect(colourOf(colours, null)).toBe(TEAM_COLOR.other)
  })
})
