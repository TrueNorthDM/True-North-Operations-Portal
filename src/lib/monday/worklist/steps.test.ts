import { describe, it, expect } from 'vitest'
import { seedSteps, pickDateColumn, pickLanguageColumn, doneLabelIndices, isStageStatus, currentStage, readStages, type BoardColumn } from './steps'

// Columns as Monday returns them. A status carries its labels and which of them
// count as done, because the rule reads both.
const p = (id: string, title: string): BoardColumn => ({ id, title, type: 'multiple-person' })
const d = (id: string, title: string): BoardColumn => ({ id, title, type: 'date' })
const dd = (id: string, title: string): BoardColumn => ({ id, title, type: 'dropdown' })
function s(id: string, title: string, labels: Record<number, string>, done: number[]): BoardColumn {
  return { id, title, type: 'status', settings_str: JSON.stringify({ labels, done_colors: done }) }
}
const WORK = { 0: 'Working on it', 1: 'Done', 2: 'Stuck', 4: "Hasn't Started Yet", 10: 'Not Relevant' }
const step = (id: string, title: string) => s(id, title, WORK, [1])

const named = (cols: BoardColumn[]) =>
  seedSteps(cols).map(x => [x.peopleTitle, x.stages.map(st => `${st.statusTitle} by ${st.dateTitle}`)])

describe('seedSteps', () => {
  // BM - General Audits, as the board lays it out. The rule before this paired
  // SEO with Kick-Off, whose done label does not exist, so 127 rows could never
  // close and 116 of them were marked late.
  it('reads the status that has a deadline, not the first status after the owner', () => {
    expect(named([
      d('date9', 'Published On'),
      s('status02', 'Priority', { 0: 'Normal', 2: 'High' }, [1]),
      s('status00', 'Audit Type', { 0: 'Content', 1: 'Recovery Action' }, []),
      p('people4', 'SEO'),
      s('status2', 'Kick-Off', { 3: "Let's do this!", 4: "Hasn't Started Yet" }, [1]),
      step('status8', 'Audit'), d('date', 'Audit By'),
      p('people7', 'SEO Sup'), step('status0', 'SEO Review'), d('date3', 'Review by'),
      p('people5', 'Web'), step('status4', 'Implementation'), d('date7', 'Implement By'),
    ])).toEqual([
      ['SEO', ['Audit by Audit By']],
      ['SEO Sup', ['SEO Review by Review by']],
      ['Web', ['Implementation by Implement By']],
    ])
  })

  // HFA - AI Writing: the Design Needs column Stephanie's old tasks came from.
  // It says whether design is needed; the stage with the deadline is the next one.
  it('skips a "Needs" column and takes the stage the deadline closes', () => {
    expect(named([
      p('m1', 'SEO 3'),
      s('c1', 'Design Needs', { 1: 'Needed', 2: 'Not Needed' }, [1]),
      step('c2', 'Media/Meta & Alt Tags'), d('d1', 'Create By'),
      s('c3', 'Ready to Translate', { 1: 'Yes', 2: 'No' }, [1]),
    ])).toEqual([['SEO 3', ['Media/Meta & Alt Tags by Create By']]])
  })

  // AAAF - Photo Curation Audits. "Assign" carries "No edits needed" and has no
  // deadline, so the Assigner is not a step: the case Stephanie raised.
  it('does not make a step of a status with no deadline', () => {
    const steps = seedSteps([
      p('people', 'Assigner'),
      s('status', 'Assign', { ...WORK, 6: 'No edits needed' }, [1]),
      p('people3', 'SEO'), step('status5', 'Photo Curation Audit'), d('date6', 'Create by'),
    ])
    expect(steps.map(x => [x.peopleTitle, x.stages.length])).toEqual([['Assigner', 0], ['SEO', 1]])
    expect(steps[0].statusCol).toBeNull()
    expect(steps[0].stepName).toBe('Assigner')
  })

  // AAAF - General Audits puts the owner between the status and its deadline.
  it('finds an owner that sits between the status and its deadline', () => {
    expect(named([
      step('status7', 'Audit'), p('people4', 'SEO'), d('date1', 'Audit by'),
      p('people', 'SEO Sup'), step('status', 'SEO Review'), d('date', 'Review By'),
    ])).toEqual([
      ['SEO', ['Audit by Audit by']],
      ['SEO Sup', ['SEO Review by Review By']],
    ])
  })

  // AAAF - SEO & Writing: ReWrite 2 and Editorial Final have deadlines of their
  // own and no people column of their own.
  it('gives a stage with no owner column to the owner before it', () => {
    expect(named([
      p('rw', 'ReWrite'), step('s1', 'ReWrite'), d('d1', 'ReWrite Deadline'),
      step('s2', 'ReWrite 2'), d('d2', 'ReWrite 2 Deadline'),
      p('e2', 'Editor 2'), step('s3', 'Editorial 2nd Revision'), d('d3', 'Editorial 2nd Rev'),
      step('s4', 'Editorial Final'), d('d4', 'Final Deadline'),
    ])).toEqual([
      ['ReWrite', ['ReWrite by ReWrite Deadline', 'ReWrite 2 by ReWrite 2 Deadline']],
      ['Editor 2', ['Editorial 2nd Revision by Editorial 2nd Rev', 'Editorial Final by Final Deadline']],
    ])
  })

  // Graphics - Social Media: Designer 2 comes after Final Approval, and owns the
  // Doc Placement that follows the next date.
  it('reaches back past a date for a stage whose owner column came earlier', () => {
    expect(named([
      p('fa', 'Final Approver'), step('s1', 'Final Approval'), p('d2', 'Designer 2'), d('v', 'Verify By'),
      step('s2', 'Doc Placement'), d('pl', 'Place By'),
    ])).toEqual([
      ['Final Approver', ['Final Approval by Verify By']],
      ['Designer 2', ['Doc Placement by Place By']],
    ])
  })

  // Accounting: the last status before the date is Priority, whose done label is
  // "High". The done test alone would take it.
  it('never takes Priority, even when Monday gives it a done label', () => {
    expect(named([
      p('person', 'Person'), step('status', 'Status'),
      s('prio', 'Priority', { 0: 'Low', 1: 'High' }, [1]), d('date', 'Date'),
    ])).toEqual([['Person', ['Status by Date']]])
  })

  it('does not take a status that no label can finish', () => {
    expect(named([
      p('t1', 'Tech 1'), s('sw', 'Set up Webinar', { 0: 'Working on it', 4: "Hasn't Started Yet" }, [1]), d('d', 'Set up By'),
    ])).toEqual([['Tech 1', []]])
  })

  it('does not treat a dropdown as a stage', () => {
    expect(named([p('pe1', 'SEO'), dd('dd1', 'Audit'), d('d1', 'Audit By')])).toEqual([['SEO', []]])
  })

  it('makes nothing of a date with no status before it', () => {
    expect(named([p('m', 'Moderator'), d('r', 'Date Reported')])).toEqual([['Moderator', []]])
  })

  it('records column order, which is the order the workflow runs in', () => {
    const out = seedSteps([step('a', 'X'), p('pe1', 'One'), d('d1', 'By'), p('pe2', 'Two'), step('b', 'Y'), d('d2', 'By 2')])
    expect(out.map(x => x.position)).toEqual([1, 3])
  })
})

describe('doneLabelIndices and isStageStatus', () => {
  it('ignores a done index that has no label behind it', () => {
    expect(doneLabelIndices(JSON.stringify({ labels: { 3: "Let's do this!" }, done_colors: [1] }))).toEqual([])
    expect(doneLabelIndices(JSON.stringify({ labels: { 1: 'Done', 10: 'Not Relevant' }, done_colors: [1, 10] }))).toEqual([1, 10])
  })

  it('survives settings it cannot read', () => {
    expect(doneLabelIndices(null)).toEqual([])
    expect(doneLabelIndices('not json')).toEqual([])
  })

  it('rejects attributes by name, whatever Monday says about their labels', () => {
    expect(isStageStatus(s('x', 'Kick-Off', { 1: 'Go' }, [1]))).toBe(false)
    expect(isStageStatus(s('x', 'Extra Design Needs', { 1: 'Needed' }, [1]))).toBe(false)
    expect(isStageStatus(s('x', 'Writing Need', { 1: 'Moderate Rewrite' }, [1]))).toBe(false)
    expect(isStageStatus(step('x', 'Staging'))).toBe(true)
  })
})

describe('currentStage', () => {
  it('is the first stage not finished', () => {
    const r = currentStage([{ done: true, n: 1 }, { done: null, n: 2 }, { done: false, n: 3 }])
    expect(r?.stage.n).toBe(2)
    expect(r?.allDone).toBe(false)
  })

  it('is the last stage when every stage is finished', () => {
    const r = currentStage([{ done: true, n: 1 }, { done: true, n: 2 }])
    expect(r?.stage.n).toBe(2)
    expect(r?.allDone).toBe(true)
  })

  it('is nothing for a step with no stages', () => {
    expect(currentStage([])).toBeNull()
  })
})

describe('readStages', () => {
  it('tells a row seeded before stages from a people column that is not a step', () => {
    expect(readStages(null)).toBeNull()
    expect(readStages([])).toEqual([])
    expect(readStages([{ statusCol: 's', statusTitle: 'S', dateCol: 'd', dateTitle: 'D' }, { junk: true }]))
      .toEqual([{ statusCol: 's', statusTitle: 'S', dateCol: 'd', dateTitle: 'D' }])
  })
})

describe('pickDateColumn', () => {
  it('takes a title that ends in "by"', () => {
    expect(pickDateColumn([d('c1', 'Created On'), d('c2', 'Audit By')])?.title).toBe('Audit By')
  })

  it('takes a title that says deadline or due', () => {
    expect(pickDateColumn([d('c1', 'Draft Deadline')])?.title).toBe('Draft Deadline')
    expect(pickDateColumn([d('c1', 'Due Date')])?.title).toBe('Due Date')
    expect(pickDateColumn([d('c1', 'Due-Date')])?.title).toBe('Due-Date')
  })

  it('never falls back to a record of the past', () => {
    expect(pickDateColumn([d('c1', 'Published On')])).toBeNull()
    expect(pickDateColumn([d('c1', 'Item Creation')])).toBeNull()
  })

  it('reads by and on as the opposites they are', () => {
    expect(pickDateColumn([d('c1', 'Publish By')])?.title).toBe('Publish By')
    expect(pickDateColumn([d('c1', 'Published On')])).toBeNull()
  })
})

describe('pickLanguageColumn', () => {
  it('finds the column called Language', () => {
    expect(pickLanguageColumn([p('p1', 'SEO 2'), s('color_mkqr7s1t', 'Language', { 0: 'Spanish', 1: 'English' }, [1])])?.id).toBe('color_mkqr7s1t')
  })

  // Subitems of HFA - Translations has all three.
  it('ignores columns that only mention the word', () => {
    expect(pickLanguageColumn([
      p('people_mkm18azx', 'Language Editor'),
      step('status_mkm1r1s5', 'Language Editing'),
      s('status', 'Language', { 0: 'French', 1: 'Swahili' }, []),
    ])?.id).toBe('status')
  })

  it('returns nothing on a board without one', () => {
    expect(pickLanguageColumn([p('p1', 'Writer'), step('s1', 'Writing'), d('d1', 'Write By')])).toBeNull()
  })
})
