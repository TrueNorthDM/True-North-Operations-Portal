/**
 * The one look of an error (owner, 31 October 2026). Error and alert text
 * is the badge red (--bdg-red-fg) everywhere, in place of Tailwind's
 * red-500 to red-800; an error box is a soft red block with no border.
 *
 * A save refused inside a North Time form shows through SaveError
 * (components/clocky/entries/ui.tsx); the toast is that file's Toast.
 * Margins and widths stay at the call site.
 */

/** Error or alert text: the badge red. */
export const ERROR_TEXT = 'text-[#c8323d]'

/** An error box (role="alert"): soft red, 10px corners, no border. */
export const ERROR_BOX = 'rounded-[10px] bg-[#fdeeef] text-[#c8323d] px-3 py-2 text-[12.5px]'
