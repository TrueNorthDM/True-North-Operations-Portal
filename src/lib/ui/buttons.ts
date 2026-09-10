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

/** The shell: shape, weight and the word colour. The symbol is set separately. */
export const BTN = {
  navy: 'inline-flex items-center gap-2.5 bg-tn-primary text-white rounded-[10px] px-[18px] py-[11px] font-(family-name:--font-display) font-extrabold text-[13px] tracking-[.02em] shadow-[0_8px_20px_-8px_rgba(1,35,88,.55)] transition-transform hover:-translate-y-px',
  white: 'inline-flex items-center gap-2.5 bg-white text-tn-ink border border-slate-200 rounded-[10px] px-[16px] py-[11px] font-(family-name:--font-display) font-extrabold text-[13px] tracking-[.02em] shadow-[0_1px_2px_rgba(1,35,88,.06)] transition-all hover:border-tn-teal',
} as const
