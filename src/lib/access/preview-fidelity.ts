/**
 * Where the View Stage can be believed, and where it cannot.
 *
 * The preview swaps the LEVEL, never the database identity. Each column is an
 * iframe carrying a signed token that says "render as a team leader", but the
 * session inside it is still the admin's own. So anything the portal narrows
 * with row-level security renders the ADMIN's rows wearing another level's
 * interface.
 *
 * That is not a footnote. On 2026-09-01 a team leader reported a client report
 * showing no hours and a carried-in balance of the entire year's budget, while
 * the same tier in the View Stage looked correct. Both were telling the truth
 * about what they read: the report took its hours from tc_entries through the
 * session, and tc_entries answers the time clock's question ("your hours, plus
 * the people you approve"), not the report's. The preview could never have
 * caught it, because the admin's session reads everything.
 *
 * The fix for the reports was to stop deciding access in the database and
 * decide it here, where the Access levels page can show the rule. What is left
 * in this list is what still narrows by identity, and the View Stage says so on
 * screen rather than quietly showing the wrong thing.
 *
 * Keep this list SHORT and true. An entry here is an admission that a screen
 * cannot be previewed; the better move is almost always to move that screen's
 * rule into the access layer and delete the entry.
 *
 * Pure module (no server imports) so the client canvas can render from it.
 */

export interface PreviewCaveat {
  /** The surface key from access/surfaces.ts, so the two stay in step. */
  surfaceKey: string
  label: string
  /** What the preview shows instead of the truth, in plain words. */
  shows: string
}

export const PREVIEW_CAVEATS: readonly PreviewCaveat[] = [
  {
    // My Hours until 16 October 2026, when it became Clocky's Time entries.
    // Clocky reads privileged and scopes in app code, so whose hours a level
    // reaches follows the preview; "My" is still the person signed in.
    surfaceKey: 'clocky-hours',
    label: 'Clocky',
    shows: 'your own hours under My, not the previewed person’s. The preview cannot sign in as somebody else. Whose hours each level reaches, and what it can change, follow the previewed level.',
  },
] as const

/** True when every screen a level reaches renders faithfully under preview. */
export const PREVIEW_IS_COMPLETE = PREVIEW_CAVEATS.length === 0
