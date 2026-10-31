/**
 * The two buttons the portal has, and the one rule that separates them.
 *
 *   navy  -> white words, gold symbol
 *   white -> navy words,  green symbol
 *
 * A button carries its symbol in a different colour from its words so the
 * symbol reads as the action and the words as the label. Before this the navy
 * buttons drew their icon in `currentColor`, which made it the same white as
 * the label, and the white buttons drew theirs in teal, which is the brand
 * accent rather than a button colour.
 *
 * Here rather than in each button because thirty-one files draw one. A rule
 * written in thirty-one places is a rule that disagrees with itself within a
 * month, and the sweep that fixes it has to be run again every time.
 * buttons.test.ts reads the source and fails when one drifts back.
 */

/** The symbol colour for each button, as a value an svg attribute can take. */
export const BTN_ICON = {
  navy: 'var(--color-btn-on-navy)',
  white: 'var(--color-btn-on-white)',
} as const

export type BtnTone = keyof typeof BTN_ICON

/**
 * The shells: shape, weight and the word colour. The symbol is set separately.
 * The owner approved this set on 31 October 2026 and it is the only source:
 * North Time's BTN_* constants (clocky/entries/ui.tsx) are aliases of these.
 *
 * White words are written `text-[#ffffff]`, not `text-white`: dark mode remaps
 * `--color-white` to a dark surface, which would turn the words navy-on-navy.
 *
 * Width, margins, flex placement and the disabled look stay at the call site.
 */
const FACE = 'font-(family-name:--font-display) font-extrabold tracking-[.02em] cursor-pointer no-underline'
const FULL = `inline-flex items-center gap-2.5 rounded-[10px] py-[11px] text-[13px] ${FACE}`
const SMALL = `inline-flex items-center whitespace-nowrap gap-[7px] rounded-[9px] px-3 py-[7px] text-[12.5px] ${FACE}`

const NAVY = 'bg-tn-primary text-[#ffffff] transition-colors hover:bg-[#0a2f6b]'
const WHITE = 'bg-white text-tn-ink border border-slate-200 transition-all hover:border-tn-teal'
const DANGER = 'bg-[#c8323d] text-[#ffffff] transition-colors hover:bg-[#b02a34]'
const WHITE_DANGER = 'bg-white text-[#c8323d] border border-slate-200 transition-all hover:border-[#c8323d]'

export const BTN = {
  /** Primary: navy, white words. */
  navy: `${FULL} px-[18px] ${NAVY} shadow-[0_8px_20px_-8px_rgba(1,35,88,.55)]`,
  /** Secondary: white, navy words, teal edge on hover. */
  white: `${FULL} px-[16px] ${WHITE} shadow-[0_1px_2px_rgba(1,35,88,.06)]`,
  /** A destructive confirmation (Delete, Remove for good): solid red. */
  danger: `${FULL} px-[18px] ${DANGER} shadow-[0_8px_20px_-8px_rgba(200,50,61,.5)]`,
  /** A secondary destructive action (Deny, Remove in a row): white with red words. */
  whiteDanger: `${FULL} px-[16px] ${WHITE_DANGER} shadow-[0_1px_2px_rgba(1,35,88,.06)]`,

  /** The compact size for rows and toolbars, in the same four families. */
  smallNavy: `${SMALL} ${NAVY}`,
  smallWhite: `${SMALL} ${WHITE}`,
  smallDanger: `${SMALL} ${DANGER}`,
  smallWhiteDanger: `${SMALL} ${WHITE_DANGER}`,

  /** A 32px square symbol button (arrows, more, edit). */
  icon: 'inline-flex flex-none cursor-pointer items-center justify-center w-8 h-8 rounded-[8px] border-0 bg-transparent text-muted transition-colors hover:bg-subtle hover:text-tn-ink',
  /** A text button: teal words, underline on hover, no box. */
  link: 'inline-flex items-center gap-1.5 cursor-pointer border-0 bg-transparent p-0 font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-teal hover:underline',
} as const

export type BtnKind = keyof typeof BTN
