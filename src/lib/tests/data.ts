/**
 * tests/data.ts — the manual test checklist for the whole system (admin page at
 * /admin/tests). Code-based and maintained by Claude: every feature we ship
 * adds its checks here, so the portal can be verified end-to-end.
 *
 * Each case is one checkable item: what to DO and what to EXPECT. The page lets
 * you tick them off (saved in your browser). Next free id per area is implicit.
 */

export interface TestCase {
  id: string
  check: string //   what to do
  expect: string //  what should happen
  needs?: string //  precondition (admin, a migration, a grant, …)
}

export interface TestArea {
  area: string
  cases: TestCase[]
}

export const TEST_AREAS: TestArea[] = [
  {
    area: 'Navigation & access',
    cases: [
      { id: 'NAV-1', check: 'Log in and look at the left sidebar.', expect: 'Home, Dashboards, Projects, Tools are shown; Admin appears only if you are an admin; Settings sits at the bottom.' },
      { id: 'NAV-2', check: 'Open /admin (or click Admin).', expect: 'Admins see the Admin hub; a non-admin is redirected to Home (Admin never shows for them).', needs: 'to fully test, a non-admin account' },
      { id: 'NAV-3', check: 'Go to a sub-page (e.g. Admin → People) and use the breadcrumb.', expect: 'Breadcrumb reads Dashboard / Admin / People and each crumb links back.' },
      { id: 'NAV-4', check: 'Visit several pages (Home, HFA, Admin, Settings).', expect: 'All share the same warm off-white background — consistent everywhere.' },
    ],
  },
  {
    area: 'Home · Org chart',
    cases: [
      { id: 'ORG-1', check: 'Open Home.', expect: 'The “Organization” section shows the company org chart: a tree from David Sharpe down, ~33 people, with team chips on cards.', needs: 'migrations 014 + 015 applied' },
      { id: 'ORG-2', check: 'Scroll the chart horizontally if it is wide.', expect: 'Connector lines link managers to reports; nothing overlaps or breaks.' },
    ],
  },
  {
    area: 'Admin · Tickets',
    cases: [
      { id: 'TIX-1', check: 'Open Admin → Tickets. Try the search and the type/status filters.', expect: 'Stat cards show counts; filtering narrows the table; statuses show coloured badges.' },
    ],
  },
  {
    area: 'Admin · People',
    cases: [
      { id: 'PPL-1', check: 'Open Admin → People.', expect: 'Table lists everyone with title, “Reports to”, teams, account, status; search works.' },
      { id: 'PPL-2', check: 'Click “Add person”, fill name + title + a manager, save.', expect: 'The person appears in the list with those values.' },
      { id: 'PPL-3', check: 'Edit someone’s “Reports to”, save, then open Home.', expect: 'The org chart redraws with the new reporting line — no manual repositioning.' },
      { id: 'PPL-4', check: 'On a row, click Delete → Yes.', expect: 'The person is removed (after the inline confirm).' },
      { id: 'PPL-5', check: 'Edit a person, set “Portal account” to an email, save. Then try linking the same account to a second person.', expect: 'First save shows the email in the Account column; the second is rejected with “already linked to another person”.', needs: 'migration 017 applied' },
    ],
  },
  {
    area: 'Admin · Teams',
    cases: [
      { id: 'TM-1', check: 'Open Admin → Teams, click “Add team”, name it, add.', expect: 'The new team appears as a card.' },
      { id: 'TM-2', check: 'Open a team. Add a person (Members panel), then remove one.', expect: 'Member list updates; the person’s team chip on the org chart updates too.' },
      { id: 'TM-3', check: 'In the team, grant a project (e.g. AAAF) a role, then change the role dropdown.', expect: 'The grant appears under “Project access”; changing the role saves instantly.' },
      { id: 'TM-4', check: 'Remove a project grant; rename the team; delete a throwaway team (confirm).', expect: 'Each change persists after reload.' },
    ],
  },
  {
    area: 'Admin · Access',
    cases: [
      { id: 'ACC-1', check: 'Open Admin → Access.', expect: 'A Teams × Projects matrix; each cell shows the team’s role (or “none”).' },
      { id: 'ACC-2', check: 'Change a cell to viewer/member/admin, then back to “none”.', expect: 'The grant is created/updated/removed; the same change shows in the team’s detail.' },
    ],
  },
  {
    area: 'Access enforcement',
    cases: [
      { id: 'ENF-1', check: 'With no grants set, open /projects as any logged-in user.', expect: 'Both AAAF and HFA cards are visible (nothing is hidden until a project is granted).', needs: 'migration 016 applied' },
      { id: 'ENF-2', check: 'Grant AAAF to one team only; log in as a non-admin NOT in that team (with a linked account).', expect: 'That user no longer sees AAAF in /projects and /aaaf redirects them home; admins still see everything.', needs: 'a non-admin account linked to a person' },
    ],
  },
  {
    area: 'Projects · hreflang',
    cases: [
      { id: 'PRJ-1', check: 'Open Projects.', expect: 'AAAF and HFA cards with their stats (completed / remaining / recent).' },
      { id: 'PRJ-2', check: 'Open HFA. Use search and the status/language filters.', expect: 'Pages grouped On-going / Completed / Not relevant; filters narrow the list.' },
      { id: 'PRJ-3', check: 'Click a page (eye icon) to open its detail.', expect: 'The page’s saved URLs + generated hreflang block appear.' },
      { id: 'PRJ-4', check: 'On HFA/AAAF header, click “Manage access” (admin only).', expect: 'You land on the Access matrix.' },
    ],
  },
  {
    area: 'Dashboards',
    cases: [
      { id: 'DSH-1', check: 'Open Dashboards.', expect: 'Two cards: “Publishing Goals” and “Workload — IN CONSTRUCTION”.' },
      { id: 'DSH-2', check: 'Open Publishing Goals.', expect: 'The COE dashboard fills the whole content area with the portal’s top bar + sidebar around it; Home is always reachable.' },
      { id: 'DSH-3', check: 'Open Workload (/boards-beta) and switch Goals / Translation / Targets.', expect: 'All three render with real data. (Note: Boards Review’s purpose is being rethought — TN-019.)' },
    ],
  },
]
