/**
 * One set of status icons for the whole portal (annual review handoff, 3
 * November 2026, "Status icons"): before it, check, lock and eye were drawn by
 * hand in about fifteen files, two or three ways each. Each state is one
 * 24x24 stroke path, the format of lib/nav/nav-icons.ts, and means what the
 * Pill of the same colour means:
 *
 *   done      circle with a check   green   done, complete, approved
 *   progress  pencil                amber   started, not finished; waiting on you
 *   todo      empty circle          gray    not started
 *   locked    padlock               gray    someone else writes it, or it is closed
 *   info      eye                   blue    for reference, read only
 *   turn      chevron right         navy    the step that is yours now
 */

export const STATUS_ICON = {
  done: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
  progress: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  todo: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  locked: 'M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V7a4 4 0 0 1 8 0v4',
  info: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  turn: 'M9 6l6 6-6 6',
} as const

export type StatusState = keyof typeof STATUS_ICON

/** Each state's colour, on the badge tokens the Pill uses, so the two always agree. */
export const STATUS_COLOR: Record<StatusState, string> = {
  done: 'var(--bdg-green-fg)',
  progress: 'var(--bdg-orange-fg)',
  todo: 'var(--muted)',
  locked: 'var(--bdg-slate-fg)',
  info: 'var(--bdg-blue-fg)',
  turn: 'var(--color-tn-ink, #012358)',
}

export const STATUS_TIP: Record<StatusState, string> = {
  done: 'Done', progress: 'In progress', todo: 'Not started', locked: 'Locked', info: 'For reference', turn: 'Your turn',
}
