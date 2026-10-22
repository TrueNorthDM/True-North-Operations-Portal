/**
 * The portal's history (People > History, "The portal" tab): the record of what
 * the portal became and when.
 *
 * This file is a source of truth. When something big ships, ask the portal's
 * owner whether it belongs here before adding it; never add an entry without a
 * yes. A new milestone usually touches TIMELINE (if it has an exact date),
 * BUILT (one row), and NEXT when something moves from planned to built. Keep
 * NUMBERS and UPDATED current when you touch the page.
 *
 * Writing rules for this page: no dashes, plain English, real dates. A NEXT
 * item is a bold lead and the rest of its line (which starts with its own space,
 * comma or colon).
 */

export const UPDATED = 'October 7, 2026'

/** The headline number and the four facts beside it. As of UPDATED. */
export const NUMBERS = {
  headline: { value: '746', label: 'updates shipped in 132 days, from May 28 to October 7, 2026' },
  facts: [
    { value: '31', label: 'people on the team' },
    { value: '138,330', label: 'time entries since 2017' },
    { value: '~50,000', label: 'Monday assignments' },
    { value: 'Oct 5', label: 'moved to its own server' },
  ],
}

/** The horizontal timeline: its span, the exact dates, and what each month brought. */
export const TIMELINE = {
  start: '2026-05-28',
  end: '2026-10-07',
  /** The gold line reaches this day: what has already happened. */
  reached: '2026-10-06',
  marks: [
    { date: '2026-05-28', words: 'May 28', label: 'Href Links begins' },
    { date: '2026-06-08', words: 'Jun 8', label: 'It becomes the Operations Portal' },
    { date: '2026-07-17', words: 'Jul 17', label: 'Directory becomes the HR record' },
    { date: '2026-09-23', words: 'Sep 23', label: 'The move is planned' },
    { date: '2026-10-05', words: 'Oct 5', label: 'A home of its own, then staging', key: true },
  ],
  months: [
    { from: '2026-06-01', to: '2026-07-01', lines: ['Publishing Goals', 'Directory, Home'] },
    { from: '2026-07-01', to: '2026-08-01', lines: ['i7 report, View Stage', 'the True North look'] },
    { from: '2026-08-01', to: '2026-09-01', lines: ['North Time, Access levels', 'Project Hours'] },
    { from: '2026-09-01', to: '2026-10-01', lines: ['My Work, Report', 'new navigation'] },
  ],
}

/** Chapter 1: how it started. */
export const BEGINNINGS = [
  { date: 'May 28, 2026', title: 'It begins as Href Links', text: 'An hreflang tag tracker for the AskAnAdventistFriend (AAAF) and Hope for Africa (HFA) WordPress sites. It replaced two Google Sheets workflows, and from day one it talked to Monday: when a page was marked in Monday, the portal knew.' },
  { date: 'June 8, 2026', title: 'It becomes the True North Operations Portal', text: 'It took its name and absorbed the Boards Review dashboard, the former COE Dashboard with the translation pipeline and weekly publishing goals. Today that is Publishing Goals.' },
  { date: 'June 9, 2026', title: 'It gets its shape', text: 'The People and Teams directory with access by team, an admin area with Tickets and Tests, and the sections it still has: dashboards, projects, tools and admin.' },
]
export const WHY = 'The work lived in scattered spreadsheets, separate dashboards and manual exports, each with its own login and its own version of the numbers. The portal puts them in one place, on live data, with one sign-in.'

/** Chapter 2: what it is for. */
export const PURPOSE = {
  line: 'One home for the tools, dashboards, and tasks that keep your team moving every day.',
  points: [
    { title: 'Live data', text: 'Straight from the systems the team already uses, Monday and QuickBooks Time, instead of copies typed by hand.' },
    { title: 'Everyone sees what is theirs', text: 'Leaders see their team, admins see everything, and clients get clean reports.' },
    { title: 'One place to look', text: 'One sign-in, one address, one place for the day\'s work.' },
  ],
}

/** Chapter 3: what we built, in the order it arrived. */
export const BUILT: { when: string; what: string; how: string; isNew?: boolean }[] = [
  { when: 'May 2026', what: 'Href Links', how: 'Hreflang tags per page for AAAF and HFA, kept in step with Monday. Replaced two spreadsheets.' },
  { when: 'June 2026', what: 'Publishing Goals', how: 'Weekly publishing pace against target, per client, read from the Monday boards.' },
  { when: 'June 2026', what: 'Home and search', how: 'A personal home with widgets and favourites, and Cmd+K to jump anywhere.' },
  { when: 'June, July 2026', what: 'Directory and Organization', how: 'People, teams and the org chart. On July 17 it became the HR source of truth.' },
  { when: 'July 2026', what: 'i7 Budget Usage Report', how: 'Hours, cost and budget usage for i7 Marketing, straight from QuickBooks Time, with PDF, CSV and image exports. Replaced exports and pivot tables done by hand every month.' },
  { when: 'July 2026', what: 'View Stage and True North Team', how: 'Admins preview the portal as each level sees it; the Monday team board, mirrored live.' },
  { when: 'August 2026', what: 'Access levels', how: 'What each level can open, set by an admin on one board.' },
  { when: 'August 2026', what: 'Project Hours and Others', how: 'The project tracking sheet accounting kept by hand, now automatic, with donations, a month by month table and exports.' },
  { when: 'August 2026', what: 'North Time', how: 'The portal became the time clock, with history back to 2017.' },
  { when: 'Aug, Sep 2026', what: 'My Work and My Team', how: 'Everyone\'s Monday steps across every board in one list, and team leaders set their team\'s priority order.' },
  { when: 'September 2026', what: 'Report', how: 'Team leaders read their team\'s workload and pace.' },
  { when: 'September 2026', what: 'Navigation and Notifications', how: 'A navy rail with panels and search, and a bell for new work, deadlines and syncs, with a daily summary.' },
  { when: 'Jul to Sep 2026', what: 'The True North look', how: 'The whole portal rebranded to True North Digital Marketing\'s identity.' },
  { when: 'October 2026', what: 'A home of its own', how: 'Its own server and address, sign-in by invitation with a second step on the phone, nightly backups, and a staging copy where every change is tried before the team sees it.', isNew: true },
]

/** Chapter 4: the move, phase by phase. */
export const MOVE = {
  intro: 'On September 23 the plan was written. On October 5 the portal moved to truenorthportal.online, on True North\'s own server, two days ahead of the deadline. Nothing was lost on the way.',
  done: { value: '67 of 67', text: 'Every step of the plan, across nine phases, finished between September 23 and October 6, 2026. The team was offline for one evening instead of the three days planned for.' },
  facts: [
    { k: 'New address', v: 'truenorthportal.online' },
    { k: 'Sign-in', v: 'By invitation, 6‑digit code, second step on the phone' },
    { k: 'Owned by', v: 'True North: code, server, data and address' },
  ],
  phases: [
    { n: 0, title: 'Getting ready', text: 'The plan, the new address and the new home were chosen.', dates: 'Sep 23', steps: 6 },
    { n: 1, title: 'The code moved to True North', text: 'The portal\'s code moved to an account True North owns, with its full history.', dates: 'Sep 28', steps: 6 },
    { n: 2, title: 'The new address was connected', text: 'truenorthportal.online was set up on Cloudflare, which keeps it fast and protected.', dates: 'Sep 28', steps: 4 },
    { n: 3, title: 'The new server was built', text: 'The new home was built next to the old portal, which kept running as usual.', dates: 'Sep 28 to Oct 5', steps: 10 },
    { n: 4, title: 'The portal and the new sign-in were prepared', text: 'The new sign-in went live on the old portal first, so it was proven before the move.', dates: 'Sep 28 to Sep 30', steps: 9 },
    { n: 5, title: 'Dress rehearsal', text: 'The whole move was run once on a test copy: the data copied in about a minute, every count matching.', dates: 'Oct 5', steps: 4 },
    { n: 6, title: 'Moving day', text: 'The old portal paused, the data was copied and checked, the new address switched on, and the team signed in again the same evening.', dates: 'Oct 5', steps: 12, offline: true },
    { n: 7, title: 'The old accounts were closed', text: 'A last copy of the old data was kept, and only the portal\'s old pieces were closed.', dates: 'Oct 5', steps: 4 },
    { n: 8, title: 'Wrap up', text: 'The COE tools were saved in True North\'s GitHub, the team got True North access, two-step sign-in started for everyone, and the owner\'s manual was written.', dates: 'Sep 29 to Oct 6', steps: 12 },
  ],
  moved: [
    { piece: 'Code', before: 'An outside GitHub account', now: 'True North\'s GitHub organization' },
    { piece: 'The portal', before: 'Vercel', now: 'True North\'s own server' },
    { piece: 'Data, sign-in and files', before: 'Supabase cloud', now: 'The same open-source services, on True North\'s server' },
    { piece: 'Address', before: 'A long hosting address', now: 'truenorthportal.online. Old links still lead there' },
    { piece: 'Sign-in', before: 'A single email link, for any company address', now: 'Invited people only, a 6‑digit code and a second step on the phone' },
  ],
}

/** Chapter 5: what comes next. Ideas and work in progress, never promises with dates. */
export const NEXT = [
  { kind: 'building' as const, label: 'Being built', items: [['North Time', ' reports, approvals and invoices'], ['My Hours', ' for each person']] },
  { kind: 'planned' as const, label: 'Planned', items: [['Chat and Emails', ', in the Messages drawer already in the top bar'], ['My Work', ' showing when a step is waiting on the previous one, with a notification when it is ready']] },
  { kind: 'possible' as const, label: 'Possible', items: [['SEO tools', ': Schema App, Schema Scraper, Knowledge Graph, Page Auditor, Image Optimization, Analytics and Impact Globe'], ['The COE team\'s prototypes', ' of five of them are saved in True North\'s GitHub, ready to be brought into the portal']] },
]
