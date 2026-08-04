/**
 * Which Monday items get flipped to "Apply Link" once a page is complete.
 *
 * Pulled out of runLinkHandler so it can be tested without a database and a
 * Monday API. The handler around it is all IO; this is the one decision in it.
 *
 * THE RULE. One item per language that is still ACTIVE on the site and has a
 * URL saved. `page_urls` outlives the language list on purpose: pausing or
 * removing a language keeps its rows so the history survives, and the project
 * page shows them faded with a "language discontinued" badge for someone to
 * deal with later. The handler used to send every row, so a paused language's
 * item was told to apply its link anyway, which is the opposite of what pausing
 * it meant (audit finding M5-1).
 */

export interface PageUrlRow {
  language_code: string
  monday_item_id: string | null
}

export function siblingItemsToApply(
  urlRows: readonly PageUrlRow[],
  activeLanguages: readonly string[],
): string[] {
  const active = new Set(activeLanguages)
  return urlRows
    .filter(r => active.has(r.language_code))
    // A row with no Monday item id has nothing to flip: it was saved before we
    // started tracking the source item, or came from a manual edit.
    .map(r => r.monday_item_id)
    .filter((id): id is string => !!id)
}
