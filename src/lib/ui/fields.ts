/**
 * The one look every typed field in the portal shares: text, number, email
 * and password inputs, and textareas (owner, 31 October 2026). It was the
 * most used of the field styles already ("Family A"): 40px high, radius 10,
 * the panel border, 13px ink, and a teal border with a soft teal ring on
 * focus. Before this some twenty files kept their own copy, and the copies
 * had drifted to grey fills, 44px Agenda fields and fields with no focus ring.
 *
 * Width, margins, flex placement and alignment (text-right, tabular-nums)
 * stay at the call site.
 */

const RING = 'focus:border-tn-teal focus:shadow-[0_0_0_3px_rgba(30,125,127,.15)]'
const KEY_RING = 'focus-visible:border-tn-teal focus-visible:shadow-[0_0_0_3px_rgba(30,125,127,.15)]'
const TEXT = 'text-tn-ink placeholder:text-muted outline-none disabled:opacity-60'
const FILL = 'bg-white border-[var(--panel-border)]'

/**
 * The shapes without the border colour and fill, for a tinted field (a
 * required reason in amber, a cell in red when it does not read). Tint
 * classes do not fight the defaults this way.
 */
export const INPUT_SHAPE = `h-10 box-border px-3 border rounded-[10px] text-[13px] ${TEXT} ${RING}`
export const INPUT_SM_SHAPE = `h-8 box-border px-2.5 border rounded-[8px] text-[12.5px] ${TEXT} ${RING}`
export const TEXTAREA_SHAPE = `box-border resize-y px-3 py-2.5 border rounded-[10px] font-sans text-[13px] ${TEXT} ${RING}`

/** The field: inputs of every typed kind. */
export const INPUT = `${INPUT_SHAPE} ${FILL}`

/** The compact field for table cells and inline row edits: 32px, radius 8. */
export const INPUT_SM = `${INPUT_SM_SHAPE} ${FILL}`

/** The textarea: the field's look with no fixed height; min-h goes at the call site. */
export const TEXTAREA = `${TEXTAREA_SHAPE} ${FILL}`

/**
 * The closed date and month field (ui/DateField): the field's box. Its ring
 * shows on keyboard focus only, since the field is a button that keeps focus
 * after a click and draws its own ring while the calendar is open.
 */
export const DATE_FIELD_CLASS = `h-10 box-border px-3 border rounded-[10px] text-[13px] ${TEXT} ${FILL} ${KEY_RING}`

/** The compact date field, for table cells: INPUT_SM's box. */
export const DATE_FIELD_SM = `h-8 box-border px-2.5 border rounded-[8px] text-[12.5px] ${TEXT} ${FILL} ${KEY_RING}`

/**
 * A menu trigger (ui/Select's className) set in a row of fields: the field's
 * height, border, corners and text size, so the row lines up.
 */
export const SELECT_FIELD = `h-10 box-border px-3 border rounded-[10px] text-[13px] ${FILL}`
