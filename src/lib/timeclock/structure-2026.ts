/**
 * The 2026 job structure (David's "Time-Tracking Structure: Job Codes and
 * Activities", with the owner's changes of 26 and 27 October 2026), and the
 * translation table from the TSheets structure it replaces.
 *
 * Every entry from the switch date answers: Client, Division, Project,
 * Activity, Billable (from the project) and Notes. Entries before the switch
 * keep the old job and fields for good; the translation table below only puts
 * report rows from both sides next to each other. It never rewrites an entry.
 *
 * Pure data and lookups: no database, safe on the client.
 */

// ── The new structure ───────────────────────────────────────────────────────

export interface NewProject { name: string }
export interface NewDivision { name: string; projects: NewProject[] }
export interface NewClient {
  name: string
  /** Billable follows the project, and every project of a client shares it. */
  billable: boolean
  /** True North Internal has no divisions: its projects sit under the client. */
  divisions: NewDivision[]
  projects: NewProject[]
}

const p = (...names: string[]): NewProject[] => names.map(name => ({ name }))
const codes = (...entities: string[]): NewProject[] => entities.flatMap(e => p(`${e}-MKTG`, `${e}-WEBDVT`, `${e}-ADMIN`))

export const I7_CLIENT = 'i7 Marketing'
export const COE_CLIENT = 'COE Group'
export const TN_CLIENT = 'True North Internal'

export const STRUCTURE: NewClient[] = [
  {
    name: I7_CLIENT, billable: true, projects: [],
    // The i7 codes are the projects; the division is the block of the i7 report.
    divisions: [
      { name: 'i7 Marketing', projects: codes('i7') },
      { name: 'Wagner Meters', projects: codes('WM', 'WMFL', 'WMFP', 'WMW') },
      { name: 'Bessemeter', projects: codes('BE') },
      { name: 'Moisture Meters', projects: codes('MME') },
    ],
  },
  {
    name: COE_CLIENT, billable: true, projects: [],
    divisions: [
      { name: 'Seeker Outreach', projects: p('AAAF', 'Seeker Outreach General') },
      { name: 'Education', projects: p('Digital Evangelism Academy', 'Education General') },
      { name: 'Sharing Tools', projects: p('Ask A Friend QR Cards', 'Mobile Sharing App', 'Sharing Tools General') },
      { name: 'Fundraising', projects: p('System Build', 'List Building', 'Donor Relations/Journey', 'Campaign Development', 'Church Presentations', 'Newsletter', 'Fundraising General') },
      { name: 'Trust & Authority', projects: p('COE Website', 'Trust Portfolio', 'Networking: Centers of Influence', 'Content Syndication', 'Trust & Authority General') },
      { name: 'Africa', projects: p('Public University Outreach', 'HopeFor.Africa', 'Africa Social Media', 'Africa Events', 'Africa Small Projects', 'Africa Admin/Exec', 'Africa General') },
      // GP Church and GP School keep these exact names: the Grants Pass report finds them by name.
      { name: 'Client: Grants Pass', projects: p('GP Church', 'GP School') },
      { name: 'Client: NAD', projects: p('NAD General') },
      // Events are always "Event: " and the event.
      { name: 'Event: ASI', projects: p('ASI General') },
    ],
  },
  { name: TN_CLIENT, billable: false, divisions: [], projects: p('TN Website', 'TN Operations', 'TN General') },
]

export interface Activity { name: string; family: string; covers: string; notesRequired?: boolean }

export const ACTIVITIES: Activity[] = [
  { family: 'Content', name: 'Content: Strategy & Briefs', covers: 'Briefs, content planning, course outlines' },
  { family: 'Content', name: 'Content: Writing', covers: 'Pages, articles, thought leadership, study guides, lead magnet copy, newsletter copy, course content' },
  { family: 'Content', name: 'Content: Editing', covers: 'Review, editing, revision' },
  { family: 'Content', name: 'Content: Translation', covers: 'Translation and localization; note the language in Notes' },
  { family: 'Creative', name: 'Design/Graphics', covers: 'Infographics, ad creatives, QR cards, print materials' },
  { family: 'Creative', name: 'Video', covers: 'Video and audio production' },
  { family: 'Web & Systems', name: 'Web Dev & Systems', covers: 'Websites, mobile app, fundraising system build, course platform, CRM and automations' },
  { family: 'SEO', name: 'SEO: Research', covers: 'Keyword, topic, and audience research' },
  { family: 'SEO', name: 'SEO: Optimization', covers: 'Web pages, social content, and routine optimization work' },
  { family: 'SEO', name: 'SEO: Issues', covers: 'Technical problems and incidents' },
  { family: 'SEO', name: 'SEO: Reporting', covers: 'Performance reports and analysis' },
  { family: 'Marketing', name: 'Marketing: Strategy & Campaigns', covers: 'Campaign development, promotion, paid ads, syndication planning' },
  { family: 'Marketing', name: 'Marketing: Social Media & Community', covers: 'Posting, community and platform engagement' },
  { family: 'Marketing', name: 'Marketing: Email', covers: 'Newsletters, follow-up sequences, donor emails' },
  { family: 'Outreach', name: 'Relationships', covers: 'Donor stewardship, moves management, networking, partner contact' },
  { family: 'Outreach', name: 'Presenting & Training', covers: 'Church presentations, university training, delivering workshops' },
  { family: 'Events', name: 'Event', covers: 'Preparing for, attending, and following up on events' },
  { family: 'Events', name: 'Event: Travel', covers: 'Travel time to and from events' },
  { family: 'Operations', name: 'Leadership/Management', covers: 'Supervision, staff development, organizational leadership, exec work' },
  { family: 'Operations', name: 'Project Management', covers: 'Planning, coordinating, and tracking projects' },
  { family: 'Operations', name: 'Meeting: Status', covers: 'Individual status meetings' },
  { family: 'Operations', name: 'Meeting: Project', covers: 'Meetings about a specific project' },
  { family: 'Operations', name: 'Meeting: Other', covers: 'Any other meeting; describe it in Notes', notesRequired: true },
  { family: 'Operations', name: 'Admin', covers: 'General admin, payroll, and finance tasks' },
  { family: 'Operations', name: 'Professional Development', covers: 'Receiving training, industry monitoring' },
  { family: 'Operations', name: 'Other', covers: "Anything that doesn't fit; Notes are required", notesRequired: true },
]

export const ACTIVITY_FAMILIES = [...new Set(ACTIVITIES.map(a => a.family))]

/** Where a project sits: "COE Group › Africa › HopeFor.Africa". */
export interface Place { client: string; division: string | null; project: string | null }
export const placeText = (pl: Place): string => [pl.client, pl.division, pl.project].filter(Boolean).join(' › ')

/** Every project with its place and billable, in the structure's order. */
export function allProjects(): (Place & { project: string; billable: boolean })[] {
  return STRUCTURE.flatMap(c => [
    ...c.divisions.flatMap(d => d.projects.map(pr => ({ client: c.name, division: d.name, project: pr.name, billable: c.billable }))),
    ...c.projects.map(pr => ({ client: c.name, division: null, project: pr.name, billable: c.billable })),
  ])
}

/** The i7 division of an i7 code, as the i7 report's blocks (mapCodeToProject). */
export function i7DivisionOf(code: string): string | null {
  const c = code.trim().toUpperCase()
  if (c.startsWith('I7-')) return 'i7 Marketing'
  if (c.startsWith('MME-')) return 'Moisture Meters'
  if (c.startsWith('BE-')) return 'Bessemeter'
  if (/^WM(FL|FP|W)?-/.test(c)) return 'Wagner Meters'
  return null
}

// ── The translation table (old TSheets values to the new structure) ──────────

/**
 * How sure a line is. 'same': the same thing under a new name or place.
 * 'closest': the nearest new value, good for reports; 'check': Tina, David or
 * Rock should confirm. 'none': no new home; it stays its own row in history.
 */
export type Sureness = 'same' | 'closest' | 'check' | 'none'
export interface Translation {
  old: string; to: Place | string | null; sure: Sureness; why?: string
  /** An old Activity value that also says where the work sits (Fundraising is now a division). */
  place?: Place
}

const at = (client: string, division: string | null = null, project: string | null = null): Place => ({ client, division, project })

/** TSheets field "2 Project". */
export const OLD_PROJECTS: Translation[] = [
  { old: 'AAAF', to: at(COE_CLIENT, 'Seeker Outreach', 'AAAF'), sure: 'same' },
  { old: 'Africa', to: at(COE_CLIENT, 'Africa'), sure: 'same', why: 'The whole Africa division; the old field did not say which Africa project.' },
  { old: 'ASI', to: at(COE_CLIENT, 'Event: ASI', 'ASI General'), sure: 'same' },
  { old: 'GP church', to: at(COE_CLIENT, 'Client: Grants Pass', 'GP Church'), sure: 'same' },
  { old: 'GP School', to: at(COE_CLIENT, 'Client: Grants Pass', 'GP School'), sure: 'same' },
  { old: 'NAD', to: at(COE_CLIENT, 'Client: NAD', 'NAD General'), sure: 'same' },
  { old: 'Rwanda', to: at(COE_CLIENT, 'Africa', 'Africa Small Projects'), sure: 'same', why: 'One-off Africa tasks go to Africa Small Projects.' },
  { old: 'In-House', to: null, sure: 'none', why: 'A mix of True North and COE work; it stays its own row in history and is not split.' },
  { old: 'GYC', to: null, sure: 'none', why: 'No hours in 2026; created as "Event: GYC" if it comes back.' },
  { old: "Messiah's Mansion", to: null, sure: 'none', why: 'No hours in 2026; created as "Event: Messiah\'s Mansion" if it comes back.' },
  { old: 'Called!', to: null, sure: 'none', why: 'No hours in 2026; created as "Event: Called!" if it comes back.' },
  { old: 'Internship', to: null, sure: 'none', why: 'No hours in 2026; probably a True North Internal project if it comes back.' },
  { old: 'not listed--ask Dave', to: null, sure: 'none', why: 'Unknown by definition; stays its own row.' },
]

/** TSheets field "1 Company". */
export const OLD_COMPANIES: Translation[] = [
  { old: 'True North', to: at(TN_CLIENT), sure: 'same' },
  { old: 'COE', to: at(COE_CLIENT), sure: 'same' },
  { old: 'DDI', to: at(COE_CLIENT), sure: 'same', why: 'DDI is part of the COE Group.' },
  { old: 'GNA/COEI', to: at(COE_CLIENT), sure: 'same', why: 'GNA and COEI are part of the COE Group.' },
]

/** TSheets top-level jobs (clients). */
export const OLD_JOBS: Translation[] = [
  { old: '1 - True North', to: null, sure: 'same', why: 'A folder of departments, not a client (about 21,000 hours in 2026, most of them COE work). The client comes from "2 Project" (AAAF, Africa, ASI, NAD, GP: COE Group), and only for In-House or no project from "1 Company" (Arnaldo, Oct 29: 2,469 hours of AAAF carry Company "True North").' },
  { old: '2 - i7 Marketing', to: at(I7_CLIENT), sure: 'same', why: 'The division comes from the i7 code.' },
  { old: 'Adventist Messengers/HFA', to: at(COE_CLIENT, 'Africa', 'HopeFor.Africa'), sure: 'same', why: 'Confirmed by Arnaldo on Oct 27: the Africa work.' },
  { old: 'DDI', to: at(COE_CLIENT), sure: 'same' },
  { old: 'GNA', to: at(COE_CLIENT), sure: 'same' },
  { old: 'A.org Job', to: null, sure: 'none', why: 'The A.org engagement ended; stays its own row in history.' },
]

/** TSheets field "3 Activity", to the 26 activities. */
export const OLD_ACTIVITIES: Translation[] = [
  { old: 'Content Briefs', to: 'Content: Strategy & Briefs', sure: 'same' },
  { old: 'Content: Writing', to: 'Content: Writing', sure: 'same' },
  { old: 'Content: Review/Edit', to: 'Content: Editing', sure: 'same' },
  { old: 'Content: Revision', to: 'Content: Editing', sure: 'same' },
  { old: 'Translation', to: 'Content: Translation', sure: 'same' },
  { old: 'Graphic creation', to: 'Design/Graphics', sure: 'same' },
  { old: 'Marketing: AAF Cards', to: 'Design/Graphics', sure: 'same', why: "David's document: now Design/Graphics under the QR Cards project." },
  { old: 'WebDev', to: 'Web Dev & Systems', sure: 'same' },
  { old: 'SEO Research', to: 'SEO: Research', sure: 'same' },
  { old: 'SEO: Routine', to: 'SEO: Optimization', sure: 'same' },
  { old: 'SEO (unspecified)', to: 'SEO: Optimization', sure: 'closest', why: 'Retired in the new list; Optimization is the routine SEO work.' },
  { old: 'SEO: Issues/Incidents', to: 'SEO: Issues', sure: 'same' },
  { old: 'SEO Reports', to: 'SEO: Reporting', sure: 'same' },
  { old: 'Marketing: Plan/Strategy', to: 'Marketing: Strategy & Campaigns', sure: 'same' },
  { old: 'Marketing: Social Media', to: 'Marketing: Social Media & Community', sure: 'same' },
  { old: 'Social Media', to: 'Marketing: Social Media & Community', sure: 'same' },
  { old: 'Marketing: Newsletter', to: 'Marketing: Email', sure: 'same' },
  { old: 'Marketing: Other (specify in Notes)', to: 'Other', sure: 'closest' },
  { old: 'Event: Prep', to: 'Event', sure: 'same', why: 'Prep and attendance are one "Event" activity (open item for David).' },
  { old: 'Event: Attendance', to: 'Event', sure: 'same', why: 'Prep and attendance are one "Event" activity (open item for David).' },
  { old: 'Event: Travel', to: 'Event: Travel', sure: 'same' },
  { old: 'Management', to: 'Leadership/Management', sure: 'same' },
  { old: 'Project management', to: 'Project Management', sure: 'same' },
  { old: 'Meeting: Status', to: 'Meeting: Status', sure: 'same' },
  { old: 'Meeting: Project', to: 'Meeting: Project', sure: 'same' },
  { old: 'Meeting: SEO/Content', to: 'Meeting: Project', sure: 'closest', why: 'A meeting about SEO or content work for a project.' },
  { old: 'Meeting: Other (indicate in Notes)', to: 'Meeting: Other', sure: 'same' },
  { old: 'General admin', to: 'Admin', sure: 'same' },
  { old: 'Industry Monitoring', to: 'Professional Development', sure: 'same', why: "David's document: Professional Development covers industry monitoring." },
  { old: 'Training', to: 'Professional Development', sure: 'closest', why: 'Most of the 2026 hours are newcomers being trained (the Africa translators, the Rwanda SEO team, new writers); an old entry does not say who trained whom (Arnaldo, Oct 29).' },
  { old: 'Fundraising', to: 'Marketing: Strategy & Campaigns', place: at(COE_CLIENT, 'Fundraising', 'Fundraising General'), sure: 'closest', why: 'Fundraising is now a division. The 2026 hours are almost all Kevin\'s ads, funnels, email and donation forms for COE, whatever the Company field says (Arnaldo, Oct 29).' },
  { old: 'Research/Development', to: 'Other', sure: 'closest', why: 'No close match; 5 hours, all in 2022 and 2023 (Arnaldo, Oct 29).' },
  { old: 'SME', to: 'Other', sure: 'closest', why: 'Subject matter expert work; 1 hour in 2026 (Arnaldo, Oct 29).' },
  { old: 'Other (indicate in Notes)', to: 'Other', sure: 'same' },
]

/** TSheets field "Tasks" (ends on the switch date), to the 26 activities. */
export const OLD_TASKS: Translation[] = [
  { old: 'Brief Development', to: 'Content: Strategy & Briefs', sure: 'same' },
  { old: 'Content Process', to: 'Content: Strategy & Briefs', sure: 'closest' },
  { old: 'Content: Writing', to: 'Content: Writing', sure: 'same' },
  { old: 'Content: Review/Edit', to: 'Content: Editing', sure: 'same' },
  { old: 'Content: Revision', to: 'Content: Editing', sure: 'same' },
  { old: 'Translation: Review/Edit', to: 'Content: Translation', sure: 'same', why: 'All 2026 hours are the Africa translators\', and 97% of those entries already say Activity "Translation" (Arnaldo, Oct 29).' },
  { old: 'Graphics', to: 'Design/Graphics', sure: 'same' },
  { old: 'Web Dev', to: 'Web Dev & Systems', sure: 'same' },
  { old: 'SEO Research', to: 'SEO: Research', sure: 'same' },
  { old: 'SEO - Routine', to: 'SEO: Optimization', sure: 'same' },
  { old: 'SEO: A.org', to: 'SEO: Optimization', sure: 'closest', why: 'A.org has ended.' },
  { old: 'SEO: Issues/Incidents', to: 'SEO: Issues', sure: 'same' },
  { old: 'SEO: Reporting', to: 'SEO: Reporting', sure: 'same' },
  { old: 'Project Management', to: 'Project Management', sure: 'same' },
  { old: 'Project Meeting', to: 'Meeting: Project', sure: 'same' },
  { old: 'Misc (add note to explain)', to: 'Other', sure: 'same' },
  { old: 'test', to: null, sure: 'none', why: 'A test value; never used.' },
]

/** TSheets field "1 - i7 Code": the same code becomes the project under its division. */
export function oldI7Code(code: string): Translation {
  const division = i7DivisionOf(code)
  return division
    ? { old: code, to: at(I7_CLIENT, division, code.trim()), sure: 'same' }
    : { old: code, to: null, sure: 'none', why: 'Not an i7 code.' }
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
const lookup = (list: Translation[]) => (old: string | null | undefined): Translation | null =>
  old ? list.find(t => norm(t.old) === norm(old)) ?? null : null

export const translateProject = lookup(OLD_PROJECTS)
export const translateCompany = lookup(OLD_COMPANIES)
export const translateActivity = lookup(OLD_ACTIVITIES)
export const translateTask = lookup(OLD_TASKS)

/**
 * The 2026 client of a TSheets entry (owner, 29 October 2026). Its job's top
 * folder decides (Job catalogue > Clients), except the folder linked to True
 * North Internal, "1 - True North": a folder of departments that holds COE work
 * too. There the "2 Project" value decides (AAAF, Africa, ASI, NAD and GP are
 * COE Group), and only for In-House or no project the "1 Company" value.
 */
export function oldEntryClient(folderClient: string | null, project: string | null | undefined, company: string | null | undefined): string | null {
  if (folderClient !== TN_CLIENT) return folderClient
  const byProject = translateProject(project)?.to
  if (byProject && typeof byProject === 'object') return byProject.client
  const byCompany = translateCompany(company)?.to
  return byCompany && typeof byCompany === 'object' ? byCompany.client : folderClient
}
