// The prototype's sample figures for Publishing goals, shared by its check and the full Home check.

import type { PublishingBoardWeeks, PublishingWeek } from '@/lib/boards/publishing-weeks'

const MONDAYS = ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19']

/** A weekly board from [language, target, five weeks done], English first. */
function weekly(boardId: string, name: string, langs: [string, number, number[]][]): PublishingBoardWeeks {
  const weeks: PublishingWeek[] = MONDAYS.map((start, i) => {
    const rows = langs.map(([lang, target, done]) => ({ lang, done: done[i], target }))
    const en = rows.find(l => l.lang === 'English')
    return {
      start, label: start, untargeted: 0, langs: rows,
      done: rows.reduce((s, l) => s + l.done, 0),
      target: rows.reduce((s, l) => s + l.target, 0),
      en: en ? { done: en.done, target: en.target } : null,
    }
  })
  return {
    boardId, name, cycleWeeks: 1, weeks,
    langHits: Object.fromEntries(langs.map(([lang, t, done]) => [lang, done.filter(d => d >= t).length])),
    perPeriod: weeks[weeks.length - 1].target, enPerPeriod: weeks[weeks.length - 1].en?.target ?? 0,
    hits: weeks.filter(w => w.done >= w.target).length,
    enHits: weeks.filter(w => w.en && w.en.done >= w.en.target).length,
    firstCycleEnds: null, firstCycle: null,
  }
}

const cycle = (start: string, target: number, done: number): PublishingWeek =>
  ({ start, label: start, done, target, untargeted: 0, en: { done, target }, langs: [{ lang: 'English', done, target }] })

export const AAAF = weekly('462251934', 'AAAF', [
  ['English', 2, [2, 1, 0, 2, 2]], ['Spanish', 3, [3, 3, 1, 3, 3]], ['Portuguese', 2, [2, 2, 1, 2, 2]],
  ['Swahili', 2, [2, 2, 0, 2, 2]], ['Hindi', 2, [2, 2, 1, 2, 1]],
])
export const HFA = weekly('hfa', 'HFA', [
  ['English', 5, [4, 5, 2, 6, 5]], ['French', 2, [2, 2, 1, 3, 2]], ['Swahili', 2, [1, 2, 0, 3, 1]], ['Portuguese', 1, [1, 1, 0, 1, 1]],
])

const BM_CYCLES = [cycle('2026-08-17', 2, 2), cycle('2026-08-31', 2, 1), cycle('2026-09-14', 2, 2), cycle('2026-09-28', 2, 2), cycle('2026-10-12', 2, 3)]
export const BM: PublishingBoardWeeks = {
  boardId: '1764094550', name: 'Bessemeters', cycleWeeks: 2, perPeriod: 2, enPerPeriod: 2,
  weeks: BM_CYCLES, hits: 4, enHits: 4, langHits: { English: 4 }, firstCycleEnds: null, firstCycle: null,
}
export const BM_FIRST: PublishingBoardWeeks = {
  ...BM, weeks: [], perPeriod: 0, enPerPeriod: 0, hits: 0, enHits: 0, langHits: {},
  firstCycleEnds: '2026-10-25', firstCycle: { ...cycle('2026-10-12', 1, 0), label: 'Oct 12 to Oct 25' },
}

// 2:04 AM in New York on 15 October, the prototype's footer.
export const UPDATED = '2026-10-15T06:04:00Z'

