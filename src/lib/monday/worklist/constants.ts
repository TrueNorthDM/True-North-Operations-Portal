// Values the work list shares between the server loader and the browser.
//
// Their own module so the list component can import them without importing the
// loader. The loader reads the Monday account's subdomain through the
// privileged client, and a client component that imports the loader would pull
// that into the browser's module graph.

/**
 * How far back finished work is kept on the page.
 *
 * Everything ever assigned is in the database and none of it is deleted, but a
 * work list that opens on nine years of finished steps is not a work list. Six
 * months is the span in which "did we do that?" is still a live question:
 * long enough to cover a quarter and the one before it, short enough that the
 * finished block stays readable.
 *
 * Measured on when the ITEM last changed in Monday, because a step does not
 * record when it was completed. That is an approximation and the page says so:
 * an item touched for an unrelated reason keeps its finished steps in view
 * longer than they deserve.
 */
export const COMPLETED_MONTHS = 6
