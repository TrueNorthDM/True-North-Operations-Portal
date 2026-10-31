/**
 * The one look every modal in the portal shares: the overlay at 32% navy with
 * no blur, and the white card at radius 16 with the long soft shadow. The
 * North Time Modal (clocky/entries/ui.tsx) was the approved one, so its
 * classes moved here for the rest to use (owner, 31 October 2026).
 *
 * Side drawers keep their own shape but take the same overlay colour.
 */

/** The overlay colour behind a modal or a drawer. No blur. */
export const MODAL_BACKDROP = 'bg-[rgba(1,35,88,.32)]'

/** The modal card: white, radius 16, the shadow. Padding and width stay with each modal. */
export const MODAL_PANEL = 'bg-white rounded-[16px] shadow-[0_30px_70px_-20px_rgba(1,35,88,.5)]'

/**
 * The modal title: display face, extra bold, 18px, ink, no margin. Headings
 * carry -0.015em from globals.css, outside the utilities' layer: the modal
 * titles are drawn without it.
 */
export const MODAL_TITLE = 'font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink m-0'
