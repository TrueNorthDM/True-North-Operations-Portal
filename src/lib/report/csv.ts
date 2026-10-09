// The Report as a file.
//
// One builder per tab, because the promise the export menu makes is "this
// tab, this scope, this period": a CSV that always hands over the same table
// regardless of what is on screen is worse than no CSV, since the person who
// downloads it has no way to tell.
//
// Pure string work, no I/O, so the shapes can be tested without a database.

import type { PersonRow } from './types'
import type { BoardWait, StepWait, StuckItem } from './types'
import type { Overview } from './overview'
import type { WorkloadRow } from './workload'
import {
  availableHours, groupAverageWeek, loadPercent, netFlow, reading, READING_LABEL, utilisation,
} from './workload'
import { formatDays } from './overview'

/** Quote only when the cell needs it, and double any quote inside. */
export function cell(v: string | number | null): string {
  if (v === null) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const row = (cells: (string | number | null)[]) => cells.map(cell).join(',')

/**
 * A number the Report does not have.
 *
 * Empty, not 0. A spreadsheet sums a column, and a zero standing in for "no
 * history" quietly becomes part of a total somebody presents.
 */
const num = (v: number | null) => (v === null ? '' : v)

export function overviewCsv(data: Overview): string[] {
  const lines: string[] = ['Metric,Value,Note']
  for (const k of data.kpis) lines.push(row([k.label, `${k.value}${k.unit ? ` ${k.unit}` : ''}`, k.note]))

  if (data.weeks.length) {
    lines.push('', 'Week,Delivered,Late')
    for (const w of data.weeks) lines.push(row([w.label, w.total, w.late]))
  }

  lines.push('', 'Open work by age,Steps')
  for (const a of data.aging) lines.push(row([a.label, a.count]))

  if (data.held.length) {
    lines.push('', 'Person,Median held (working days),p90 (working days)')
    for (const h of data.held) lines.push(row([h.name, h.median, h.p90]))
  }
  return lines
}

export function peopleCsv(people: PersonRow[]): string[] {
  const lines = ['Person,Team,Status,Delivered,On time (%),Median held (working days),Open,Late now,Hours']
  for (const p of people) {
    lines.push(row([
      p.name, p.team, p.inactive ? 'Inactive' : 'Active', num(p.delivered), num(p.onTimePct),
      p.medianHeld === null ? '' : p.medianHeld,
      p.open, p.late, num(p.hours),
    ]))
  }
  return lines
}

export function workloadCsv(people: WorkloadRow[]): string[] {
  const average = groupAverageWeek(people)
  const lines = [
    'Person,Contracted (h/week),Typical (h/week),Utilisation (%),Load (%),Load basis,'
    + 'Arriving (per week),Finishing (per week),Net (per week),Reading',
  ]

  for (const p of people) {
    const util = utilisation(p.hoursLogged, p.contracted)
    const avail = availableHours(p.observed, average)
    const load = loadPercent(p.estimatedAhead, avail.hours)
    const net = netFlow(p.arriving, p.finishing)

    lines.push(row([
      p.name, p.contracted, num(p.observed), num(util), num(load),
      // Stated in the file too. A column of percentages with no note about
      // which of them borrowed somebody else's week is the exact thing the
      // audit panel exists to prevent on screen.
      avail.estimated ? 'group average week' : 'own hours',
      p.arriving, p.finishing, net, READING_LABEL[reading(load, net, util)],
    ]))
  }
  return lines
}

export function waitsCsv(steps: StepWait[], stuck: StuckItem[], boards: BoardWait[] = []): string[] {
  const lines = ['Step,Median held (working days),Delivered']
  for (const s of [...steps].sort((a, b) => b.median - a.median)) {
    lines.push(row([s.name, s.median, s.delivered]))
  }
  if (boards.length) {
    // The screen's By board panel, which the file used to leave out.
    lines.push('', 'Board,Delivered,Median held (working days),Late (%)')
    for (const b of [...boards].sort((a, b) => b.medianHeld - a.medianHeld)) {
      lines.push(row([b.board, b.delivered, b.medianHeld, num(b.latePct)]))
    }
  }
  lines.push('', 'Item,With,Status,Step,Held (working days)')
  for (const s of stuck) lines.push(row([s.item, s.who, s.inactive ? 'Inactive' : 'Active', s.step, s.heldDays]))
  return lines
}

/** What the file is called, and what it says it covers. */
export function exportName(tab: string, scope: string, period: number, today: string): string {
  const label = tab.charAt(0).toUpperCase() + tab.slice(1)
  return `Report ${label} - ${scope}, last ${period} days - ${today}`
}

/** A BOM, so Excel reads the accented names as UTF-8 instead of mojibake. */
export function toFile(lines: string[]): string {
  return '﻿' + lines.join('\r\n') + '\r\n'
}

export { formatDays }
