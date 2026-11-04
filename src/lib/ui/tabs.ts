/**
 * The one look for page and section tabs: a row of words with a gold
 * underline under the open one (owner, 31 October 2026; gold and 14px from the
 * annual review handoff, owner, 4 November 2026). Tabs switch between
 * views of the same page (Pending / Approved / All, Personal / Work / HR,
 * the sections of a report). A choice of mode in place is a segmented
 * control instead (segmented.ts).
 *
 * The component is components/ui/Tabs.tsx. These constants are for tabs that
 * must stay links (a Next <Link> per tab) or keep their own markup.
 */

/**
 * The row: a hairline under it, the open tab's underline sits on it.
 *
 * The hairline is an inset shadow rather than a border, and the tabs have no
 * -mb-px: a row that scrolls sideways (overflow-x-auto) clips anything below
 * its padding box, which cut the bottom of the underline and could show
 * a one-pixel vertical scrollbar. A child paints over its parent's inset
 * shadow, so the underline covers the hairline exactly as a -mb-px did.
 */
export const TAB_LIST = 'flex gap-1 shadow-[inset_0_-1px_0_var(--panel-border)] overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

/** One tab, open or not. */
export const TAB = 'flex-none inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 pt-[11px] pb-[9px] border-0 border-b-[2.5px] border-solid font-(family-name:--font-display) font-extrabold text-[14px] leading-[normal] cursor-pointer bg-transparent no-underline'

/** The open tab. */
export const TAB_ON = 'text-tn-ink border-[#F2C40A]'

/** A tab that is not open. */
export const TAB_OFF = 'text-muted border-transparent hover:text-tn-ink'

/** The count after a tab's label. */
export const TAB_COUNT = 'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums'
export const TAB_COUNT_ON = 'bg-tn-teal text-[#ffffff]'
export const TAB_COUNT_OFF = 'bg-subtle text-muted'

/** The full class for one tab. */
export const tabClass = (on: boolean) => `${TAB} ${on ? TAB_ON : TAB_OFF}`
