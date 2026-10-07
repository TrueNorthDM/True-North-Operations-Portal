/**
 * Which access items each report file needs (7 October 2026). An export needs
 * its Export item and every item whose figures the file carries, so a file can
 * never hold more than the report page shows the same person.
 *
 * Pure, so the routes, the print pages and the tests share it.
 */

export type ProjectsExport = 'client' | 'internal' | 'history'

/** Project Hours & Others: the client file has costs and money in; the internal one hours per person. */
export function projectsExportKeys(type: ProjectsExport): string[] {
  if (type === 'internal') return ['ph-export', 'ph-people']
  return ['ph-export', 'ph-costs', 'ph-money']
}

/** Client Report · i7: every file carries budget and cost, which is the whole report. */
export const I7_EXPORT_KEYS = ['i7-export', 'report-full'] as const
