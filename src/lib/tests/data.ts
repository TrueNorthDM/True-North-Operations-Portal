/**
 * tests/data.ts: the manual test checklist for the whole system (admin page at
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
      { id: 'NAV-1', check: 'Log in; look at the narrow icon-only left rail and hover each icon.', expect: 'Icons for Home, Dashboards, Projects, Tools (+ Admin if admin, Settings at the bottom); hovering shows the name as a tooltip to the right. The active page’s icon is highlighted.' },
      { id: 'NAV-2', check: 'Open /admin (or click Admin).', expect: 'Admins see the Admin hub; a non-admin is redirected to Home (Admin never shows for them).', needs: 'to fully test, a non-admin account' },
      { id: 'NAV-3', check: 'Go to a sub-page (e.g. Admin → People) and use the breadcrumb.', expect: 'Breadcrumb reads Dashboard / Admin / People and each crumb links back.' },
      { id: 'NAV-4', check: 'Visit several pages (Home, HFA, Admin, Settings).', expect: 'All share the same background tone, warm off-white in light mode, warm near-black in dark mode. Consistent everywhere.' },
    ],
  },
  {
    area: 'Sign-in by invitation',
    cases: [
      { id: 'INV-1', check: 'On the sign-in page, type a @truenorthdigitalmarketing.com address.', expect: 'Under the field: "Sign in with your @goodnewsadvocates.org address." The button stays disabled.' },
      { id: 'INV-2', check: 'Type the GoodNews address of an active person who has NOT been invited and send the link.', expect: 'Red message: the address has not been invited, ask an admin. No email arrives.', needs: 'migration 089' },
      { id: 'INV-3', check: 'Directory → open an active person with a GoodNews address and no access → Login & access → Invite.', expect: 'The pill turns to Invited and a line says which address they sign in with. They can now request a sign-in link.', needs: 'admin, migration 089' },
      { id: 'INV-4', check: 'Open a person with no GoodNews address.', expect: 'Portal access reads "No GoodNews address", with no Invite button, and says the address must be added first.' },
      { id: 'INV-5', check: 'While a test person is signed in elsewhere, Revoke their access (or make them Inactive), then have them open any page.', expect: 'They are signed out and land on the sign-in page with the "not invited" message.', needs: 'admin, a second account, migration 089' },
      { id: 'INV-6', check: 'Sign in as arnaldo.oliveira@me.com.', expect: 'Works: the founding account is the one exception to the GoodNews rule.' },
      { id: 'INV-7', check: 'Invite a test person (Directory → Portal access → Invite).', expect: 'The card says "Invitation sent to …". The email arrives from True North Operations Portal, names who invited, and its button opens the sign-in page with the address filled in.', needs: 'admin, RESEND_API_KEY on Vercel' },
      { id: 'INV-8', check: 'On an invited person who never signed in, press Send again.', expect: 'A second invitation arrives; the Invited date stays the first one.', needs: 'admin, RESEND_API_KEY on Vercel' },
      { id: 'INV-9', check: 'Directory → Portal access tab. Click each count on top.', expect: 'The list narrows to that group (not invited, invited but not in yet, signed in, no GoodNews address); the numbers add up to everyone active.', needs: 'admin (Directory level 3)' },
      { id: 'INV-10', check: 'Tick two people who are not invited and press Invite selected.', expect: 'A confirmation names what will happen; then "Sending 1 of 2…", then "2 invitations sent", and both rows turn to Invited.', needs: 'admin, RESEND_API_KEY on Vercel' },
      { id: 'COD-1', check: 'Sign in: type your address, press Email me a sign-in code, then type the 6 digits from the email.', expect: 'You land where you were going (Home, or the page that sent you to sign in).', needs: 'the new sign-in email template in Supabase' },
      { id: 'COD-2', check: 'Ask for a code on the computer, then press Sign in to the portal in the email on your phone, and press Sign in on the page that opens.', expect: 'The phone signs in. No "code verifier" error: the link works on any device.', needs: 'the new sign-in email template in Supabase' },
      { id: 'COD-3', check: 'Type a wrong code, then use the same code twice.', expect: 'A red message says the code is not right or has expired; nothing signs in.' },
    ],
  },
  {
    area: 'Theme & account',
    cases: [
      { id: 'THM-1', check: 'Click the moon/sun icon at the top right.', expect: 'The whole portal flips between light and dark instantly; the icon swaps. Text and badges stay readable in both.' },
      { id: 'THM-2', check: 'Toggle dark, reload, and navigate around.', expect: 'The chosen theme sticks (per browser). On a first-ever visit the portal follows the system preference, with no light flash.' },
      { id: 'THM-3', check: 'Look at the top-right corner, then click the avatar.', expect: 'The avatar (your initials, navy circle) is the rightmost element; the menu shows your email and Sign out works (back to login).' },
      { id: 'THM-4', check: 'In dark mode, open Tickets, People and a project page.', expect: 'Tables, badges and banners are readable. Known exceptions that stay light: the Publishing Goals iframe and the beta charts.' },
    ],
  },
  {
    area: 'Home · Widgets & favourites',
    cases: [
      { id: 'HOME-1', check: 'Open Home on a desktop-size window.', expect: 'Block 1 shows five widgets side by side: Dashboards, Projects, Tools (clickable) and My Team / My Work (dashed, “Soon” badge, not clickable).' },
      { id: 'HOME-2', check: 'In “My favourites”, click Choose favourites (or Edit), pick a few destinations, try picking a 6th.', expect: 'The counter shows n/5 and unchecked options disable at 5.', needs: 'migration 018 applied' },
      { id: 'HOME-3', check: 'Save, reload the page (and ideally open another browser where you are logged in).', expect: 'Your picks show as star cards, in order, and persist, they are stored per user, not per browser.' },
      { id: 'HOME-4', check: 'Click a favourite card.', expect: 'It navigates to that destination.' },
    ],
  },
  {
    area: 'Home · Org chart',
    cases: [
      { id: 'ORG-1', check: 'Open Home.', expect: 'The “Organization” section shows the company org chart: a tree from David Sharpe down, ~33 people, with team chips and team boxes, auto-scaled to fit the block width (no horizontal scroll).', needs: 'migrations 014 + 015 applied' },
      { id: 'ORG-2', check: 'Click “Full screen”, then use the − / + buttons (or the +/− keys), Reset, Esc, and drag the canvas with the mouse.', expect: 'The chart opens big; zoom out/in works (40–250%), Reset returns to 100%, you can scroll OR click-and-drag to pan, and Esc/Close exits.' },
    ],
  },
  {
    area: 'Admin · Tickets',
    cases: [
      { id: 'TIX-1', check: 'Open Admin → Tickets. Try the search and the type/status filters.', expect: 'Stat cards show counts; filtering narrows the table; statuses show coloured badges.' },
    ],
  },
  {
    area: 'Admin · System manual',
    cases: [
      { id: 'MAN-1', check: 'Open Admin → System manual; click a Contents link.', expect: 'The manual lists sections (Overview, Access, Pages, Monday, Data, Roadmap); jump links scroll to them; the Monday section explains the two flows + token.' },
    ],
  },
  {
    area: 'Admin · People',
    cases: [
      { id: 'PPL-1', check: 'Open Admin → People.', expect: 'Table lists everyone with title, “Reports to”, teams, account, status; search works.' },
      { id: 'PPL-2', check: 'Click “Add person”, fill name + title + a manager, save.', expect: 'The person appears in the list with those values.' },
      { id: 'PPL-3', check: 'Edit someone’s “Reports to”, save, then open Home.', expect: 'The org chart redraws with the new reporting line, no manual repositioning.' },
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
      { id: 'ENF-1', check: 'With no grants set, open /projects as any logged-in user.', expect: 'Both AAAF and HFA cards are visible (nothing is hidden until a project is granted, even if migration 016 isn’t applied yet, access fails open).' },
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
    area: 'Settings · Publishing targets',
    cases: [
      { id: 'TGT-1', check: 'Open Settings → Publishing targets.', expect: 'A per-board / per-language list of weekly targets. As admin you can change a value and Save; the change records in the history.' },
      { id: 'TGT-2', check: 'Change a target in Settings, then open Dashboards → Publishing Goals.', expect: 'The dashboard’s “target for this week” reflects the new value (both read/write the portal’s publishing_targets).' },
    ],
  },
  {
    area: 'Tools · Budget Usage Report',
    cases: [
      { id: 'TR-1', check: 'Open Tools → Budget Usage Report without a TSheets token configured in Settings.', expect: 'A “token not configured” empty state with a link to Settings, no error, no crash.' },
      { id: 'TR-2', check: 'Add a valid TSheets API token in Settings → QuickBooks Time section, save.', expect: 'Token saves and shows masked ···XXXX. Budget Usage Report page no longer shows the empty state.', needs: 'valid TSheets API token + migration 019 applied' },
      { id: 'TR-3', check: 'Open Budget Usage Report; note the default month.', expect: 'Month selector defaults to the current month; the pivot table shows hours from TSheets.', needs: 'TSheets token configured' },
      { id: 'TR-4', check: 'Switch to a past month in the selector.', expect: 'URL updates to ?month=YYYY-MM and the table reloads with the correct data for that month.', needs: 'TSheets token configured' },
      { id: 'TR-5', check: 'Inspect the pivot table structure.', expect: 'Rows = job codes, columns = employee first names, rightmost column = Total. Each cell shows hours or a dash. Row totals and column totals both sum correctly to the grand total.', needs: 'TSheets token configured' },
    ],
  },
  {
    area: 'Dashboards',
    cases: [
      { id: 'DSH-1', check: 'Open Dashboards.', expect: 'Two cards: “Publishing Goals” and “Workload, IN CONSTRUCTION”.' },
      { id: 'DSH-2', check: 'Open Publishing Goals.', expect: 'The COE dashboard fills the whole content area with the portal’s top bar + sidebar around it; Home is always reachable.' },
      { id: 'DSH-3', check: 'Open Settings → Publishing targets, change a target and save.', expect: 'It saves, and Publishing Goals counts against the new target. (Boards, the old home of this editor, was removed in September 2026.)' },
    ],
  },
]
