/**
 * What the Directory's full list (directory/page.tsx, level 3) reads and
 * carries, by the viewer's access. Kept here, apart from the page, so a test
 * holds it (audit, 8 October 2026): the list is the one place that sends a row
 * for every person in the company to the browser.
 */

/**
 * The people columns the full list reads. Personal data, HR, pay, history and
 * milestones are not among them: those are read per tab on the person's own
 * page (lib/directory/person-page-data.ts), so they never reach this list.
 */
export const LIST_COLUMNS =
  'id, full_name, title, manager_id, status, profile_id, tsheets_user_id, ' +
  'employment_type, schedule, weekly_hours, also_reports_to_id, ' +
  'email_true_north, email_goodnews, email_coe, hire_date'

/** Levels 1 and 2 (and a fallback): names and reporting only. */
export const LIST_COLUMNS_BASE = 'id, full_name, title, manager_id, status, profile_id, tsheets_user_id'

/**
 * Which of those fields a row carries: company emails with the Emails item
 * (the GoodNews one with Portal access too, which invites by it), and type,
 * schedule, hours and joined date only for the people whose Work tab the
 * viewer opens.
 */
export function listGates(can: (key: string) => boolean, ledByViewer: ReadonlySet<string>) {
  const emails = can('d-emails')
  return {
    emails,
    login: emails || can('d-portal') || can('d-invite'),
    work: (personId: string) => can('p-work') && (can('p-any') || ledByViewer.has(personId)),
  }
}
