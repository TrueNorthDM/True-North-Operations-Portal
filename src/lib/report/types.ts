// The shapes the Report's loaders hand its screens, CSVs and printouts.
//
// Here rather than beside the components that draw them, so a loader in lib
// never imports from components (audit, 9 October 2026).

export type PersonRow = {
  id: string
  name: string
  team: string | null
  /** Their team's colour, already resolved by the caller. */
  color: string
  initials: string
  delivered: number | null
  /** No longer active: listed because they delivered in the period. */
  inactive?: boolean
  /** 0 to 100, or null while there is no history to divide. */
  onTimePct: number | null
  /** Working days, the middle one. */
  medianHeld: number | null
  open: number
  late: number
  /** Timeclock, not Monday. Null for anyone not on the timeclock. */
  hours: number | null
}

export type StepWait = {
  name: string
  /** Working days from hand-off to done, the middle one. */
  median: number
  delivered: number
}

export type BoardWait = {
  board: string
  delivered: number
  medianHeld: number
  /** 0 to 100. Null when nothing delivered carried a deadline. */
  latePct: number | null
}

export type StuckItem = {
  id: string
  item: string
  who: string
  /** The person it is with is no longer active: it needs handing on. */
  inactive?: boolean
  step: string
  /** Working days it has been sitting, right now. */
  heldDays: number
}

export type EffortBasis = {
  board: string
  /** How the number was arrived at, in the units it was arrived at in. */
  basis: string
  perStep: string
  measured: boolean
}

export type SourceState = 'live' | 'to-build'

export type Source = {
  name: string
  state: SourceState
  /** How often it refreshes, read from the thing that refreshes it. */
  cadence: string
  what: string
}

export type OpenDecision = { text: string }
