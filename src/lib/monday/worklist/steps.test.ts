import { describe, it, expect } from 'vitest'
import { seedSteps, type BoardColumn } from './steps'

const col = (id: string, title: string, type: string): BoardColumn => ({ id, title, type })
const p = (id: string, title: string) => col(id, title, 'multiple-person')
const s = (id: string, title: string) => col(id, title, 'status')
const d = (id: string, title: string) => col(id, title, 'dropdown')

const named = (cols: BoardColumn[]) => seedSteps(cols).map(x => [x.peopleTitle, x.stepName, x.via])

describe('seedSteps', () => {
  // AAAF - Publishing, in the order the board actually lays them out. The
  // owner comes first and its status follows.
  it('pairs an owner with the status on its right', () => {
    expect(named([
      s('c0', 'Extra Design Needs'),
      p('pe1', 'Stager'), s('st1', 'Staging'),
      p('pe2', 'Reader'), s('st2', 'Proofing'),
      p('pe3', 'Implementer'), s('st3', 'Implementation'),
      p('pe4', 'Publisher'), s('st4', 'Publishing'),
    ])).toEqual([
      ['Stager', 'Staging', 'right'],
      ['Reader', 'Proofing', 'right'],
      ['Implementer', 'Implementation', 'right'],
      ['Publisher', 'Publishing', 'right'],
    ])
  })

  // The names carry none of this: "Tech 2" and "GPT Translation" share no word.
  // Position is the only thing that knows.
  it('pairs owners whose titles say nothing about their step', () => {
    expect(named([
      p('pe1', 'Tech 2'), s('st1', 'GPT Translation'),
      p('pe2', 'Creator'), s('st2', 'Translated Doc'),
      p('pe3', 'Proofreader 1'), s('st3', 'Proof Page'),
      p('pe4', 'Editor'), s('st4', 'Page Editing'),
    ])).toEqual([
      ['Tech 2', 'GPT Translation', 'right'],
      ['Creator', 'Translated Doc', 'right'],
      ['Proofreader 1', 'Proof Page', 'right'],
      ['Editor', 'Page Editing', 'right'],
    ])
  })

  it('falls back to the left when nothing follows the owner', () => {
    expect(named([s('st1', 'Publishing'), p('pe1', 'Publisher')]))
      .toEqual([['Publisher', 'Publishing', 'left']])
  })

  it('stops at the next owner rather than reaching past them', () => {
    expect(named([p('pe1', 'Writer'), p('pe2', 'Editor'), s('st1', 'Editing')]))
      .toEqual([['Writer', 'Writer', 'none'], ['Editor', 'Editing', 'right']])
  })

  // Two owners cannot own one status. Saying "unpaired" is the honest answer;
  // handing the same step to both would read as real and be wrong.
  it('never gives one status to two owners', () => {
    const out = seedSteps([s('st1', 'Review'), p('pe1', 'A'), p('pe2', 'B')])
    expect(out.filter(x => x.statusCol === 'st1')).toHaveLength(1)
    expect(out.find(x => x.peopleTitle === 'B')!.via).toBe('none')
  })

  // "Audit Type" and "Writing Level" are dropdowns. Pairing an owner with one
  // invents a step that never existed.
  it('does not treat a dropdown as a step', () => {
    expect(named([p('pe1', 'SEO'), d('dd1', 'Audit Type'), s('st1', 'Audit')]))
      .toEqual([['SEO', 'Audit', 'right']])
  })

  it('keeps an unpaired owner, named after itself', () => {
    expect(named([p('pe1', 'Watcher')])).toEqual([['Watcher', 'Watcher', 'none']])
  })

  it('records column order, which is the order the workflow runs in', () => {
    const out = seedSteps([s('a', 'X'), p('pe1', 'One'), s('b', 'Y'), p('pe2', 'Two')])
    expect(out.map(x => x.position)).toEqual([1, 3])
  })
})
