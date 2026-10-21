/**
 * tests/data.ts: the manual test checklist for the whole portal (admin page at
 * /admin/tests, drawn by components/TestChecklist.tsx). Kept in code so every
 * feature that ships adds its checks here, and the portal can be verified end
 * to end by a person clicking through it.
 *
 * Rewritten for the current portal (audit, 10 October 2026): the old list
 * described screens that no longer exist. Every check names the real button,
 * tab or message, so a tester can tell pass from fail without asking.
 *
 * Each case is one checkable item: what to DO and what to EXPECT. Results are
 * saved in the tester's browser by id, so the ids are new (old results must not
 * attach to new checks) and must stay unique. Area names must match the emoji
 * map in TestChecklist.tsx.
 */

export interface TestCase {
  id: string
  check: string //   what to do
  expect: string //  what should happen
  needs?: string //  precondition (a level, a second account, a test person, ...)
}

export interface TestArea {
  area: string
  cases: TestCase[]
}

export const TEST_AREAS: TestArea[] = [
  {
    area: 'Sign-in and two-step',
    cases: [
      { id: 'SIGN-1', check: 'Signed out, open the sign-in page and type an address that is not @goodnewsadvocates.org (for example a @truenorthdigitalmarketing.com one).', expect: 'Under the field: "Sign in with your @goodnewsadvocates.org address." The "Email me a sign-in code" button stays disabled.' },
      { id: 'SIGN-2', check: 'Type the GoodNews address of an active person who has not been invited, and press "Email me a sign-in code".', expect: 'A red message: "This address hasn\'t been invited to the portal. Ask an admin to invite you." No email arrives.', needs: 'a test person, not invited' },
      { id: 'SIGN-3', check: 'Type your own address, press "Email me a sign-in code", then type the 6 digits from the email and press "Sign in".', expect: 'The page says "Check your inbox" while waiting. After the code you land on the page you were going to, or else the start page chosen in Settings (Home by default).' },
      { id: 'SIGN-4', check: 'Ask for a code on the computer, then open the same email on your phone, press "Sign in to the portal", and press "Sign in" on the page that opens.', expect: 'The phone signs in. The link works on any device, and opening it alone does not sign in until the button is pressed.' },
      { id: 'SIGN-5', check: 'Type a wrong code. Then sign in with a good code and try the same code again in a new sign-in.', expect: 'Both times: "That code is not right, or it has expired. Check the latest email, or send a new one." Nothing signs in.' },
      { id: 'SIGN-6', check: 'Sign in with the founding account (the one address outside @goodnewsadvocates.org that the portal allows).', expect: 'It signs in: the founding account is the only exception to the GoodNews rule, and it still asks for its two-step code.', needs: 'the founding account' },
      { id: 'SIGN-7', check: 'Open a test person who is not invited, tab "HR and access", and press Invite next to Invitation.', expect: 'The pill turns to Invited and the line says "Invitation sent to <their GoodNews address>." The email subject reads "<your name> invited you to the True North Operations Portal" and its button opens the sign-in page with the address already filled in.', needs: 'Admin, a test person' },
      { id: 'SIGN-8', check: 'On a test person who is invited, press Revoke and confirm "Revoke access" while they are signed in elsewhere, then have them open any page.', expect: 'The dialog reads "Revoke <name>\'s access?". They are signed out and land on the sign-in page with the "hasn\'t been invited" message.', needs: 'Admin, a second account' },
      { id: 'SIGN-9', check: 'As a newly invited person, sign in for the first time.', expect: 'The two-step setup screen appears ("Add a second step") with "Skip for now (7 days left)". Skipping opens the portal with a yellow strip on every page: "Set up two-step sign-in: N days left", and a "Set it up now" button.', needs: 'a test person, an authenticator app' },
      { id: 'SIGN-10', check: 'Avatar menu, "Two-step sign-in". Scan the QR code with an authenticator app, type its 6-digit code and press "Turn on two-step sign-in". Then sign out and sign in again.', expect: 'The yellow strip and the menu row go away. At the next sign-in the portal asks for the app code ("Continue") before any page opens; a wrong one says "That code is not right. Codes change every 30 seconds: type the one the app shows now."', needs: 'an authenticator app' },
      { id: 'SIGN-11', check: 'As Super Admin, open the page of someone with two-step on, tab "HR and access", press Reset next to Two-step sign-in and confirm.', expect: 'The dialog reads "Reset <name>\'s second step?". The row turns to "Not set up yet"; they are signed out and scan a new QR code at their next sign-in. An Admin sees the status but no Reset button.', needs: 'Super Admin, a test person with two-step on' },
    ],
  },
  {
    area: 'Access levels',
    cases: [
      { id: 'ACC-1', check: 'As Super Admin, open Admin, then Access levels.', expect: 'Tabs Permissions, People and levels, Check a person, Exceptions and Change log. The Permissions table has four columns, Super Admin, Admin, Team Leader and User, each with its count of people, and an eye to preview every level except Super Admin.', needs: 'Super Admin' },
      { id: 'ACC-2', check: 'As an Admin, type /admin/access-levels and then /admin/view-stage in the address bar.', expect: 'Both send you to Home. Neither appears on the Admin landing page for an Admin.', needs: 'an Admin account' },
      { id: 'ACC-3', check: 'In Permissions, search for "APIs & tokens", "How it runs", "Reset someone\'s two-step" and "Teams and positions". Press Edit.', expect: 'Each row carries the SUPER ADMIN ONLY badge and has no tick for Admin, Team Leader or User; hovering says "Super Admin only, cannot be given". Super Admin always has everything.', needs: 'Super Admin' },
      { id: 'ACC-4', check: 'Press Edit, change one tick, then try to leave the page. Come back and press Discard.', expect: 'A navy bar says "1 change not saved yet. Nothing changes for anyone until you review and save." Leaving asks "You have 1 unsaved change. Leave this page without saving them?" Discard puts everything back.', needs: 'Super Admin' },
      { id: 'ACC-5', check: 'Change a tick, press "Review and save", type a reason shorter than 8 characters, then a proper one, and press "Save changes".', expect: 'The window "Check what changes, then say why" lists what changes for whom. "Save changes" stays disabled until the reason is long enough. After saving, the Change log shows the entry with your reason and Super Admins get a notification.', needs: 'Super Admin' },
      { id: 'ACC-6', check: 'Exceptions, "+ Add an exception": pick a test person, an item they can open, Effect "Cannot open", Until "End of the month", a reason, and press "Add exception". Then "Check a person" for them.', expect: 'The exception is listed with its end date and reason. Check a person shows the item closed and names the exception as the rule that decided it. "End now", a reason, then "End it" removes it, and both steps are in the Change log.', needs: 'Super Admin, a test person' },
      { id: 'ACC-7', check: 'Change log: press Undo on a recent entry, type a reason under "Why undo? Required" and press "Undo the change".', expect: 'What was there before comes back. The undo is a new entry pointing at the one it reverses; nothing is erased from the log.', needs: 'Super Admin' },
      { id: 'ACC-8', check: 'People and levels, with only two Super Admins: press Change next to one of them and choose Admin.', expect: 'The dialog offers Super Admin, Admin and Automatic ("Team Leader if Lead of a team, otherwise User."): Team Leader and User are never chosen directly. A yellow note says "There must always be at least two Super Admins, so nobody can be locked out by one mistake or one lost phone. Make someone else a Super Admin first." and "Save the level" stays disabled.', needs: 'Super Admin' },
      { id: 'ACC-9', check: 'Press the eye in the Team Leader column of Permissions.', expect: 'A panel "The portal for a Team Leader" shows their navigation, tabs and actions from the rules on the page, unsaved changes included, with "Open View Stage" to click through the real pages.', needs: 'Super Admin' },
      { id: 'ACC-10', check: 'Open Admin, View Stage. In the User or Team Leader column, open My Work, Team priority and move a step, or open Settings and try to change something.', expect: 'Each column shows the portal as that level sees it, as a real person of that level. Nothing saves: the order says "View Stage is only a preview. Close it to change a team\'s order." and a Settings change springs back with "View Stage is only a preview. Close it to change settings."', needs: 'Super Admin' },
    ],
  },
  {
    area: 'Directory and the person page',
    cases: [
      { id: 'DIR-1', check: 'As an Admin, open People, then Directory.', expect: 'Tabs People, Emails, Teams, Rates & Costs, Access log and Portal access, with "Add person" at the top.', needs: 'an Admin account' },
      { id: 'DIR-2', check: 'As a Team Leader, open Directory. Then, as a User, type /directory in the address bar.', expect: 'The Team Leader gets a read-only list (People and Teams, no Add person, no Emails, Rates & Costs, Access log or Portal access). The User is sent to Home, and Directory is not in their navigation.', needs: 'a Team Leader account, a User account' },
      { id: 'DIR-3', check: 'As an Admin, open someone else\'s page (/directory/<id>).', expect: 'Four tabs: Personal, Work, HR and access, Reports. HR and access says it is not shown to the person and holds Invitation, Two-step sign-in, Last access and QuickBooks Time.', needs: 'an Admin account' },
      { id: 'DIR-4', check: 'As a Team Leader, open the page of someone on a team you lead. Then change the address to the id of someone on no team you lead.', expect: 'The first opens with only the Work tab ("Kept by the company. <name> sees this tab too."), no edit button. The second shows the not-found page: a closed page and a missing one look the same.', needs: 'a Team Leader account' },
      { id: 'DIR-5', check: 'As a User, avatar menu, "My profile".', expect: 'Your own page with Personal, Work and Reports, no HR and access. Personal says "You can edit these details." with "Edit personal data"; Work says it is kept by the company.', needs: 'a User account' },
      { id: 'DIR-6', check: 'As an Admin, open your own page, tab HR and access.', expect: 'It opens, with the line that inviting, revoking and resetting two-step are not done on your own page: no Invite, Revoke or Reset buttons there.', needs: 'an Admin account' },
      { id: 'DIR-7', check: 'Directory, Portal access tab. Click each count on top.', expect: 'Groups Everyone active, Not invited, Invited, not in yet, Signed in, Two-step not set up and No GoodNews address; each narrows the list, and the columns show who signs in with which address, last sign-in and two-step.', needs: 'an Admin account' },
      { id: 'DIR-8', check: 'In Portal access, tick two people who are not invited and press "Invite 2 selected", then Send.', expect: 'The dialog says "Invite 2 people?" and "Each gets an email from the portal." Progress reads "Sending 1 of 2", then both rows turn to Invited.', needs: 'an Admin account, two test people' },
      { id: 'DIR-9', check: 'Open a person with no GoodNews address, tab HR and access.', expect: 'Invitation reads "No GoodNews address" with no Invite button, and the line "Add a @goodnewsadvocates.org address to invite them: it is the one they sign in with."', needs: 'an Admin account, a test person with no GoodNews address' },
      { id: 'DIR-10', check: 'On a test person\'s page, press Remove and read the dialog, then cancel.', expect: '"Remove <name> from the Directory?" explains their access ends at once, and that someone with hours or rates on record is made inactive instead. Nothing changes on Cancel. Remove is never offered on your own page.', needs: 'an Admin account, a test person' },
    ],
  },
  {
    area: 'Settings and notifications',
    cases: [
      { id: 'SET-1', check: 'Avatar menu, Settings (/settings).', expect: 'Five sections listed under "On this page": Notifications, Sign-in and security, Time and region, Home and start, Privacy. Changes save on their own, with no Save button.' },
      { id: 'SET-2', check: 'Time and region: choose another time zone, then another "Daily summary at" hour.', expect: 'Hours offered are 6:00 AM to 10:00 AM. The hint reads "When the daily summary reaches you, in <zone> time, Monday to Friday." Until a zone is chosen it is New York time.' },
      { id: 'SET-3', check: 'Home and start: set "After you sign in, open" to another page, sign out and sign in again. Then sign out, open a deep link and sign in.', expect: 'A plain sign-in lands on the chosen page. A link followed before signing in still goes to that link.' },
      { id: 'SET-4', check: 'Home and start, Favourites on Home: add pages until the limit, reorder them, remove one.', expect: 'Only pages you can open are offered, at most 5. Home shows them at the top in the same order.' },
      { id: 'SET-5', check: 'Privacy: turn off "Show my birthday on Home and in the Agenda" and "Show my work anniversary on Home and in the Agenda".', expect: 'Your birthday (day and month only, never the year) and anniversary no longer show on Home or in the Agenda for the team, and nobody gets the birthday bell for you.' },
      { id: 'SET-6', check: 'Notifications: press the eye on a notification, then "Send me a test" (or "Email me a test" for an emailed one).', expect: 'A preview of how it looks. The test lands in the bell marked Test ("Sent: it is in your bell now, marked Test.") or by email ("Sent: check your inbox in a minute.") with a subject starting "Test:".' },
      { id: 'SET-7', check: 'Leave a few summary notifications waiting and wait for your summary hour on a weekday. Check again on a Saturday and on the next Monday.', expect: 'One email that day, for Tools only (System notifications stay in the bell), and none when there is nothing to tell. Nothing on the weekend; Monday says "What you missed since Friday".', needs: 'notifications waiting for you' },
      { id: 'SET-8', check: 'Sign-in and security: press "Sign out on all devices" and confirm "Sign out everywhere".', expect: 'This browser is signed out at once; another signed-in device is signed out within the hour.', needs: 'a second device' },
      { id: 'SET-9', check: 'As an Admin, Admin, Notification rules. Press the lock on one notification to fix it for everyone. Then, as a User, open Settings, Notifications.', expect: 'The rules page reads "The default for everyone, and which choices people may change." The User sees that row locked, "Set by an admin", and cannot change it.', needs: 'an Admin account, a User account' },
      { id: 'SET-10', check: 'As a User, type /notifications?tab=rules in the address bar.', expect: 'You land on Settings, Notifications: the rules page is only for those given Notification rules.', needs: 'a User account' },
    ],
  },
  {
    area: 'My Work',
    cases: [
      { id: 'MW-1', check: 'Open My Work.', expect: 'Tabs My Work and My Team. The list shows "Steps still open" and "Completed" (finished, item touched in the last 6 months), and "Work pulled from Monday" with when it last refreshed; the boards are read every 4 hours.' },
      { id: 'MW-2', check: 'Change "Whose work" to Everyone, pick a person, then a team, then set "Finished work: all of it".', expect: 'The list follows each filter; "Clear filters" shows how many rows are hidden. Finished work widens to everything, not only 6 months.' },
      { id: 'MW-3', check: 'As a member of a team whose leader set an order, open your list.', expect: 'Above the list: "Ordered by the <team> team\'s priority". If no order is set: the team has no priority order yet, so the list follows True North\'s order: board priority, then deadline. Someone who may not edit sees "Only the team\'s leaders, admins and people given access can change it".' },
      { id: 'MW-4', check: 'As a Team Leader, press "Set the order" (or "Edit order"), switch "Order by" between Workspace, Board and Item, move a step, then "Save and close".', expect: 'The status reads "Saved · the <team> team sees this order". Members of the team see their own steps in that order.', needs: 'a Team Leader account' },
      { id: 'MW-5', check: 'Open the same team\'s Team priority in two browsers. Move a step in the first and let it save, then move one in the second.', expect: 'The second shows an amber warning: "Someone else changed this order a moment ago. Reload to see it." with a Reload button. It stops saving, nothing of the first is overwritten, and the main button reads Close.', needs: 'a Team Leader account, two browsers' },
      { id: 'MW-6', check: 'On any row, hover the history icon, click it, then press Escape.', expect: 'The tooltip says "Show history". A drawer opens from the right with the item, "Asking Monday" while it loads, then each change with who and when, and "Open in Monday". Escape closes it and focus returns to the row button.' },
      { id: 'MW-7', check: 'Open My Work, My Team.', expect: 'The people on your teams. Clicking a name opens their page only when your access allows it.' },
    ],
  },
  {
    area: 'Report',
    cases: [
      { id: 'REP-1', check: 'As an Admin, open Report.', expect: 'Tabs Overview, People, Workload, Where it waits, Method. "Whose work" offers Me and Everyone (and My team when you lead a team); Period offers Last 30 days and Last 90 days.', needs: 'an Admin account' },
      { id: 'REP-2', check: 'Switch Whose work between Me, My team and Everyone.', expect: 'Me shows only your own work; My team the teams you lead, taken together; Everyone the whole company, including Monday accounts nobody is linked to.', needs: 'someone who opens the Report and leads a team' },
      { id: 'REP-3', check: 'As someone without "See everyone", edit the address to ?scope=everyone, or to a team they do not lead.', expect: 'The page opens on what they may see (their teams, or themselves). Anything else in the address is dropped, not obeyed.', needs: 'a Team Leader with the Report opened on Access levels' },
      { id: 'REP-4', check: 'As a User, look for Report and type /report in the address bar.', expect: 'Not in the navigation; the address sends you to Home (by default the Report opens only for Admins).', needs: 'a User account' },
      { id: 'REP-5', check: 'People tab: click a person\'s row, then press Escape.', expect: 'A drawer with their numbers, "Delivered in this period" (Item, Step, Held, Landed) and "Hours logged, by project". Escape closes it.' },
      { id: 'REP-6', check: 'Method tab: read "How it counts". Then find a step handed to someone on a Friday and marked done the next Monday (not a holiday), and open that person\'s row on the People tab.', expect: 'The first rule reads "Held time is working days, Monday to Friday without US federal holidays, from the moment a step lands on someone to the moment it is marked done." In "Delivered in this period" that step\'s Held counts only the rest of the Friday and the part of the Monday gone by, New York time, never the weekend: always under 2.0d (landed Friday 5:00 PM, done Monday 10:00 AM shows 0.7d).' },
      { id: 'REP-7', check: 'Copy the address with a tab, scope and period chosen, and open it in another browser.', expect: 'The same tab, scope and period open: every choice travels in the address.' },
      { id: 'REP-8', check: 'As an Admin, open the export menu and choose the PDF.', expect: 'A window opens, says "Building the PDF. This takes a few seconds.", shows the PDF, and only then offers Download. The CSV downloads directly.', needs: 'an Admin account' },
    ],
  },
  {
    area: 'Client reports',
    cases: [
      { id: 'CR-1', check: 'Open Tools, Client reports, as someone granted both reports, then as someone granted only one.', expect: 'Two tabs, "i7" and "Project Hours & Others", when both are open; with one, that report alone and no tabs. Someone with neither does not see Client reports, and the address sends them Home.' },
      { id: 'CR-2', check: 'i7 report: switch between In Numbers and In Graphics, and choose another month.', expect: 'Same month as a table and as charts; the month travels in the address.' },
      { id: 'CR-3', check: 'i7, Export, Internal PDF.', expect: 'A window titled "Internal report, per person · <month>" says "Building the PDF. This takes a few seconds.", then shows the PDF. Download appears only once it is shown; Close leaves nothing downloaded.', needs: 'an Admin account' },
      { id: 'CR-4', check: 'i7, Export, Client PDF. Then choose a range of several months and open Export again.', expect: 'The client PDF opens in the same preview first. With several months the PDF buttons say "A PDF is one month. Choose a single month to make one."; the CSVs still follow the range.', needs: 'an Admin account' },
      { id: 'CR-5', check: 'Open the i7 report as a Team Leader and as an Admin for the same month.', expect: 'The same hours, budget and carried-in balance for both: whoever opens the report sees all of it. The Team Leader has no Export button.', needs: 'a Team Leader account with the i7 tool' },
      { id: 'CR-6', check: 'Project Hours & Others: switch Costs and People, then pick a team.', expect: 'With a team chosen the person columns narrow and "Totals still count everyone" is shown.' },
      { id: 'CR-7', check: 'Project Hours & Others, Export: the Client PDF, the Internal PDF and the month by month PDF.', expect: 'Each opens in the preview window ("Project hours and others", "Project hours by person", "Project hours month by month") and offers Download only after it is shown.', needs: 'an Admin account' },
    ],
  },
  {
    area: 'Publishing Goals',
    cases: [
      { id: 'PG-1', check: 'As a User or Team Leader whose team is on the Publishing Goals list, open Tools, Publishing Goals.', expect: 'The dashboard loads with boards and numbers inside the portal frame. No "The boards could not be read" or "Publishing targets could not be read" message.', needs: 'a User or Team Leader account with the tool' },
      { id: 'PG-2', check: 'As someone whose team is not on the tool\'s list, type /ops/publishing in the address bar.', expect: 'Sent to Home; Publishing Goals is not in their Tools.', needs: 'an account without the tool' },
      { id: 'PG-3', check: 'On the dashboard (period "this week" or "last week"), look at a board that published pages in a language with no target that week.', expect: 'The first card is labelled "Targeted languages" and counts only pages in languages with a target, as do Target and Completion. Pages in languages with no target show beside the counts as "+N other", never inside them, and in a row of their own, "Other languages (no target)", with "N pages, not counted toward the goal". The Publishing goals card on Home follows the same rule, week by week.' },
      { id: 'PG-4', check: 'Admin, Company settings, Publishing targets: change one weekly target and save.', expect: 'The change applies from the current week (Monday to Sunday, New York); past weeks keep the target they had. "Change history" shows who changed it and when, and the dashboard counts against the new target.', needs: 'an Admin account' },
      { id: 'PG-5', check: 'Remove one language\'s weekly target and confirm.', expect: 'The dialog reads "Remove the weekly target for <language> on <site>?" with "Past weeks keep the target they had." The removal is in the change history.', needs: 'an Admin account' },
      { id: 'PG-6', check: 'Publishing targets, Publishers: "Add a publisher" with the full name as Monday shows it, then remove one and confirm.', expect: 'The new name is listed. Removing asks "Remove <name> from publishers?" with "Their pages stop counting toward the goals." The dashboard counts change accordingly.', needs: 'an Admin account' },
      { id: 'PG-7', check: 'Company settings, Sites & languages: press Edit on a site, switch a language off, then open the dashboard. Switch it back on afterwards.', expect: 'The language moves to the bottom of the card marked Paused. On the dashboard it is gone from every period, past weeks included: no row, no target, and its pages are counted neither in "Targeted languages" nor in "+N other". Nothing is deleted: switched back on, it returns with its targets and pages.', needs: 'an Admin account' },
    ],
  },
  {
    area: 'Href Links',
    cases: [
      { id: 'HREF-1', check: 'Open Tools, Href Links, then one site (AAAF or HFA).', expect: 'Overall progress per site; the page list filters by All pages, Incomplete, Needs update and Not relevant, and shows a "First done" date for finished pages.' },
      { id: 'HREF-2', check: 'In Monday, put an https link on the site\'s own domain in a language item and set its Href Link(s) status to "Run Link".', expect: 'Shortly after, the page shows that link for the language, and Recent activity from Monday shows "Link received". When every language has a link, the sibling items move to "Apply Link".', needs: 'access to the site board in Monday' },
      { id: 'HREF-3', check: 'In Monday, do the same with an http:// link, or a link on another domain, and set "Run Link".', expect: 'Nothing is saved. Recent activity shows a Warning: "<Language> link not saved: The link must start with https://." or "The link is not a page on <site host>."', needs: 'access to the site board in Monday' },
      { id: 'HREF-4', check: 'In Monday, set a language item that has a saved link to "Done". Then do it for every language of the page.', expect: 'The language shows confirmed live under Confirmations ("Done" in Recent activity). When all current languages are confirmed, the page is done ("All live") and gets its first done date.', needs: 'access to the site board in Monday' },
      { id: 'HREF-5', check: 'On a page in the portal, type an http:// link (or a link on another site) under Language URLs and press "Save URLs".', expect: '"Nothing was saved: fix the links marked below." with the reason under the field. The help line reads "A link must be https and a page on <site host>."' },
      { id: 'HREF-6', check: 'Save a link written with the bare domain, without "www".', expect: 'It is saved with the www form of the site\'s domain.' },
      { id: 'HREF-7', check: 'Change the link of a language that is already confirmed live, and save.', expect: 'The note warns that changing a live link takes its confirmation away. After saving, that confirmation is gone and the page shows "Needs update" until the new tags are pasted and confirmed.' },
      { id: 'HREF-8', check: 'Open "Recent activity from Monday" on the site page.', expect: 'It lists recent events with coloured tags (Link received, Apply Link, Done, All live, Warning, Error) and a count of failed and to-check events. It opens by itself when something failed, and marks "new" when the latest is under 5 minutes old.' },
      { id: 'HREF-9', check: 'Mark a page "Not relevant".', expect: 'It moves to Not relevant and counts as done in the progress.' },
    ],
  },
  {
    area: 'Admin',
    cases: [
      { id: 'ADM-1', check: 'As an Admin, open Admin, Automations.', expect: 'The header sums every recorded service, warnings included: "All services operational", "N warnings", or "N services down, N warnings". Below it: "Last checked: <time>. The checks run every 4 hours."', needs: 'an Admin account' },
      { id: 'ADM-2', check: 'Look at the status of each service on Automations.', expect: 'Operational is green, Warning is amber, Down is red; services not watched read "Not monitored".', needs: 'an Admin account' },
      { id: 'ADM-3', check: 'When the latest health results are more than 9 hours old (the checks stopped), open Automations and Home.', expect: 'Automations reads "Health checks have not run" and says when they last ran. Home shows the same as a red banner, saying the other results may be out of date.', needs: 'an Admin account, stopped health checks' },
      { id: 'ADM-4', check: 'Press "Run checks now" on Automations. Then open Automations as someone without "Run the checks now".', expect: 'It reads "Running checks", then "Checks finished: every service is operational." or "Checks finished: N services need attention." Without the item, the button is not there.', needs: 'an Admin account, an account without the item' },
      { id: 'ADM-5', check: 'With one service down, and later with only a warning, open Home.', expect: 'Down: a red banner "<service> is down" (or "N services are down"). Warning only: an amber banner "<service> has a warning". Both link "Open Automations". Nothing when all is healthy; Team Leaders and Users never see it by default.', needs: 'an Admin account, a service with a problem' },
      { id: 'ADM-6', check: 'As an Admin, open Admin, Company settings. Then as Super Admin.', expect: 'The Admin has no "APIs & tokens" tab (the Monday and TSheets tokens and the webhook address). The Super Admin has it.', needs: 'an Admin account, Super Admin' },
      { id: 'ADM-7', check: 'As Super Admin, APIs & tokens, "Monday webhook URL": look at the address, press Show, press it again, then press Copy and paste it somewhere.', expect: 'Hidden, it shows the address, bullets and only the last 4 characters of the secret. Show reveals the whole URL and a second press hides it. Copy always copies the whole URL, even while hidden: "The full URL is on the clipboard."', needs: 'Super Admin' },
      { id: 'ADM-8', check: 'On APIs & tokens press Edit, then press "Generate a new secret", then Escape; press it again and confirm.', expect: 'It asks first: "Generate a new secret?", saying the current webhook URL stops working at once. Escape changes nothing. Confirming shows a new URL, hidden again.', needs: 'Super Admin' },
      { id: 'ADM-9', check: 'As an Admin, open Admin, System manual, then type ?tab=runs at the end of the address.', expect: 'Only "The portal" tab: "How it runs" (the server and where its key files live) is Super Admin only, and the address falls back to The portal. A Super Admin sees both tabs.', needs: 'an Admin account, Super Admin' },
      { id: 'ADM-10', check: 'As Super Admin, open View Stage, open a page in one column, then hover a column and click the canvas background, the zoom buttons and Fit. Then press Refresh.', expect: 'Panning, zooming and Fit leave every column on the page it shows: nothing reloads back to Home. Refresh reloads every column, the Super Admin one too, with whoever holds each level now. The zoom buttons read "Zoom out" and "Zoom in" to a screen reader.', needs: 'Super Admin' },
    ],
  },
]
