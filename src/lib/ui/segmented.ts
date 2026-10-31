/**
 * The one look for a segmented control: two to five options choosing a mode
 * or a filter in place, one picked (owner, 31 October 2026). A white box with
 * the panel border, the picked option in navy.
 *
 * The component is components/ui/Segmented.tsx. These constants are for the
 * few places that must keep their own markup (a count inside an option, a
 * toggle that is part of a larger control).
 */

/** The box around the options. */
export const SEG_BOX = 'inline-flex flex-wrap items-center gap-0.5 bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px]'

/** One option, picked or not. */
export const SEG_OPT = 'inline-flex items-center gap-1.5 whitespace-nowrap border-0 cursor-pointer rounded-[8px] px-3.5 py-[7px] font-(family-name:--font-display) font-bold text-[12.5px] leading-[normal] transition-colors disabled:opacity-40 disabled:cursor-default'

/** The picked option. */
export const SEG_ON = 'bg-tn-primary text-[#ffffff]'

/** An option not picked. */
export const SEG_OFF = 'bg-transparent text-foreground hover:bg-subtle'

/** The full class for one option. */
export const segClass = (on: boolean) => `${SEG_OPT} ${on ? SEG_ON : SEG_OFF}`
