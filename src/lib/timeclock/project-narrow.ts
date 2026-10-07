/**
 * Project Hours & Others, cut to what one person's access opens (7 October
 * 2026). Done on the server, before anything is sent: the page and its
 * history receive only these figures, so a hidden tab holds nothing.
 *
 *   costs   (ph-costs)  employee and contractor costs, and the net, which is
 *                       worked out from them; the unrated list names people
 *   money   (ph-money)  donations and billed amounts, and so the net too
 *   people  (ph-people) hours per person
 *
 * Hours per project, prepaid hours and the year columns stay for everyone who
 * opens the report. Pure.
 */

import type { ProjectHistoryBlock, ProjectTracking } from './projects'

export interface ProjectRights { costs: boolean; money: boolean; people: boolean }

export function narrowProjects(data: ProjectTracking, r: ProjectRights): ProjectTracking {
  if (r.costs && r.money && r.people) return data
  return {
    ...data,
    people: r.people ? data.people : [],
    unratedPeople: r.costs ? data.unratedPeople : [],
    rows: data.rows.map(row => ({
      ...row,
      byPerson: r.people ? row.byPerson : {},
      employeeCostThisMonth: r.costs ? row.employeeCostThisMonth : 0,
      contractorCostThisMonth: r.costs ? row.contractorCostThisMonth : 0,
      totalCosts: r.costs ? row.totalCosts : 0,
      donationsThisMonth: r.money ? row.donationsThisMonth : null,
      donationsYtd: r.money ? row.donationsYtd : null,
      netThisMonth: r.costs && r.money ? row.netThisMonth : null,
    })),
    totals: {
      ...data.totals,
      byPerson: r.people ? data.totals.byPerson : {},
      employeeCostThisMonth: r.costs ? data.totals.employeeCostThisMonth : 0,
      contractorCostThisMonth: r.costs ? data.totals.contractorCostThisMonth : 0,
      totalCosts: r.costs ? data.totals.totalCosts : 0,
    },
  }
}

/** The month by month history: costs need ph-costs, donations and net need ph-money as well. */
export function narrowHistory(blocks: ProjectHistoryBlock[], r: ProjectRights): ProjectHistoryBlock[] {
  if (r.costs && r.money) return blocks
  return blocks.map(b => ({
    ...b,
    months: b.months.map(m => ({
      ...m,
      employeeCost: r.costs ? m.employeeCost : 0,
      contractorCost: r.costs ? m.contractorCost : 0,
      donations: r.money ? m.donations : null,
      net: r.costs && r.money ? m.net : null,
    })),
  }))
}
