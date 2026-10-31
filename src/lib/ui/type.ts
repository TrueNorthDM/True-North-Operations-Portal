/**
 * The one set of headings and labels (owner, 31 October 2026). Every page
 * opens with the same title, every section with the same heading, and every
 * field carries the same small uppercase label above it.
 *
 * The clocky FieldLabel (components/clocky/entries/ui.tsx) is built from
 * FIELD_LABEL; table header cells share TH below.
 */

/** The page title, the h1 at the top of a page. */
export const PAGE_TITLE = 'm-0 font-(family-name:--font-display) font-extrabold text-[30px] leading-[normal] tracking-[-.01em] text-tn-ink'

/** A section heading inside a page, the h2. */
export const SECTION_TITLE = 'm-0 font-(family-name:--font-display) font-extrabold text-[17px] leading-[normal] text-tn-ink'

/** The smaller heading of a card or a widget ("Coming up"). */
export const CARD_TITLE = 'm-0 font-(family-name:--font-display) font-extrabold text-[15px] leading-[normal] text-tn-ink'

/** The small uppercase label's type, without a colour (for a tinted label). */
export const FIELD_LABEL_TYPE = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase leading-[normal]'

/** The small uppercase label above a field. */
export const FIELD_LABEL = `${FIELD_LABEL_TYPE} text-muted`

/**
 * A content card: white, the panel border, 14px corners, no shadow. The
 * padding stays with each card. Large hero panels may keep 16px corners.
 */
export const CARD = 'bg-white border border-[var(--panel-border)] rounded-[14px]'

/**
 * A table header cell (owner, 31 October 2026): the small uppercase label on
 * the subtle fill, over the panel border. TH_CELL leaves out the padding and
 * the alignment, for a column that sets its own: two text-align or padding
 * classes in one list do not reliably let the later one win. Print, PDF and
 * email layouts keep their own.
 */
export const TH_TYPE = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.1em] uppercase text-muted'

/** TH without padding and alignment. A tinted column takes TH_TYPE and its own fill. */
export const TH_CELL = `${TH_TYPE} bg-subtle border-b border-[var(--panel-border)]`

/** The header cell as most columns use it: left aligned, 16px by 10px. */
export const TH = `px-4 py-2.5 text-left ${TH_CELL}`
