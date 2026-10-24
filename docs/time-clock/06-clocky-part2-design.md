# Clocky part 2: system design

Oct 21, 2026. Source: `Design/design_handoff_clocky 2/` (README_PART2.md, the
`.dc.html` prototypes). Part 1 is `05-clocky-build.md`. Everything here ships to
**staging only**; nothing Clocky goes to production until the owner asks.

## 1. Requirements

### Functional

| Area | What it must do |
|---|---|
| Pay terms | Per person "Pays as": hourly, fixed monthly, fixed monthly with no timesheet; an hours allowance (week or month); employees vs contractors from `people.employment_type` |
| Routing | Hours approved by the person's Reports to; invoice by Arnaldo, or Dave for his direct reports; one step when it is the same person, for employees, and for fixed-no-timesheet; Dave's own timesheet recorded without approval |
| Timesheet + invoice | Submitting creates the invoice (contractors) or a payroll summary (employees); the 6C page shows both; Return at any step returns both and tells everyone who approved |
| Invoices | Numbering INV-YYYY-NNNN, frozen lines (hours by client, fixed line, reimbursements), states draft / waiting / approved / paid, Finance marks paid, PDF preview then download |
| Fixed, no timesheet | Invoice made on day 1 for the previous month, straight to the invoice approver |
| Time off | Employees only; form with working days, balance, who else is off; on approval: Rippling, Google Calendar, time entries; cancel an approved one through a Super Admin |
| Reimbursements | Receipt required; contractor: next open invoice; employee: RMB document that Finance pays |
| Allowance | Lines in the clock panel (90%, over), "Over" in Who's working, banner and required note on 6C; extra hours requests decided by the invoice approver |
| Agenda | PTO, birthdays (no year, opt out), anniversaries, events and milestones, team events, holidays, Good News (Google); month / week / list; Home "This week" card |
| Catalogue | The job tree, fields and options, clients owned by the portal; "When to use", billable and Company/Project defaults; the "Which job?" guide |
| Reports | Hours by client, team, person, billable; money columns only for those who may see money; Team Leaders get a Timesheet column instead |
| Settings | Integrations (Rippling, Google Calendar), Invoices (numbering, billing details, invoice approvers), Reminders |
| Profile | Payments tab (invoices or pay periods, reimbursements) for the person, Super Admins, Admins, Finance |
| Migration | Contractor to employee scheduled from the person page: last contractor month closes with a final invoice, then pay periods |

### Non-functional

- About 31 active people, a few hundred entries a week, a few dozen invoices a
  month. No load problem; correctness, privacy and history are the point.
- **Privacy:** Team Leaders never see money. As everywhere in the portal, access is
  decided in app code (`lib/access/decide.ts` and the catalogue), the money is read
  with the privileged client and only after that check; RLS never decides a
  client-facing or money number. New money tables: no grants to `authenticated`
  (as migration 113 did for Clocky).
- **History:** every decision keeps who, when and why.
- **Integrations never block a decision:** approving time off succeeds even if
  Rippling is down; the push is retried and shown.
- No em dashes in any copy or comment.

### Constraints

- Next.js 16 app router, self-hosted Supabase (staging and production databases on
  one server), deploy by push to main (staging) and "Promote to production".
- Credentials (Rippling token, Google service account) are entered by a Super Admin
  in Settings > Integrations, never by the assistant.

## 2. High-level design

```
            people (employment_type, manager_id = Reports to, hire_date, date_of_birth)
                 │
   pay_terms ────┤ (pays_as, hourly_rate, fixed_amount, allowance, effective_from)
                 │
 Time entries ── Submit ──► tc_submissions (state, step) ──► approval_events
                 │                 │
                 │                 ├── contractor ──► invoices + invoice_lines ◄── reimbursements (approved)
                 │                 └── employee   ──► payroll summary ──► outbox: rippling_hours
                 │
 Requests ── time off ──► tc_absence_requests ──► (approved) outbox: rippling_pto, gcal_event; tc_entries (absence)
          ── reimbursement ──► reimbursements ──► invoice line | reimbursement_documents
          ── extra hours ──► extra_hours_requests
 Agenda ◄── absences + people dates + agenda_events + holidays + agenda_external (Good News sync)
 Cron: day 1 fixed invoices · reminders · outbox worker · Google sync · scheduled type changes
```

Routes:

| Route | Screen |
|---|---|
| `/clocky-hours/approvals` | AP list (tabs Waiting for you, With others, Decided) |
| `/clocky-hours/approvals/timesheet/[id]` | 6C family |
| `/clocky-hours/invoices`, `/clocky-hours/invoices/[id]` | 6E, 6F |
| `/clocky-hours/reports` | 12A, 12B |
| `/requests/time-off`, `/requests/reimbursements`, `/requests/extra-hours` | 7, 9, 10E |
| `/agenda` | 8A to 8E |
| `/admin/settings#catalogue`, `#integrations`, `#invoices`, `#reminders` | 11, 13 |
| `/directory/[id]` Payments tab | 10P |
| `/which-job` (inside Clocky) | 11D |

## 3. Data model (migrations 115 onwards)

- **`pay_terms`**: person_id, pays_as (`hourly | fixed_monthly | fixed_no_timesheet`),
  hourly_rate, fixed_amount, allowance_hours, allowance_period (`week | month`),
  effective_from, set_by, reason. Effective-dated like rates. Employees have a row
  only for the allowance.
- **`tc_submissions`** (exists): states gain `hours_approved` and `recorded`; new
  columns hours_approved_by, hours_approved_at. **`approval_events`**: submission_id,
  step (`hours | invoice | both | payroll`), action (`approve | return | reopen |
  record | sent | refused`), by, at, note.
- **`invoices`**: number (unique), person_id, submission_id (null for
  fixed-no-timesheet), period_start, period_end, kind, state (`draft | waiting |
  approved | paid`), issued_on, due_on, currency `USD`, total, from_snapshot,
  to_snapshot (billing details as they were), approved_by/at, paid_on, paid_ref,
  paid_note, paid_by. **`invoice_lines`**: invoice_id, kind (`hours | fixed |
  reimbursement`), client, description, hours, rate, amount, reimbursement_id, sort.
  Lines are frozen when the invoice is made; remade on return.
- **`invoice_settings`** (one row): prefix, next_number, billing name/address/email,
  payment terms days, invoice approvers (person ids), deputy director (person id),
  finance (person id). `next_invoice_number()` takes the number under a row lock.
- **`reimbursements`**: person_id, spent_on, category, amount, currency, receipt_path
  (private storage), purpose, client_id, billable, state (`pending | approved | denied
  | on_invoice | paid`), decided_by/at/note, invoice_id, document_id.
  **`reimbursement_documents`**: number RMB-YYYY-NNNN, person_id, total, state
  (`approved | paid`), paid_*.
- **`extra_hours_requests`**: person_id, asked_by, hours, period_start, period_end,
  client_id, reason, state, decided_by/at/note.
- **`tc_absence_requests`** (exists): kind gains Unpaid; new rippling_state,
  rippling_error, rippling_sent_at, calendar_event_id, calendar_state,
  cancel_requested_at/by/reason.
- **`integration_jobs`** (outbox): kind (`rippling_pto | rippling_hours | gcal_upsert
  | gcal_delete`), ref, payload, state (`waiting_connection | queued | done |
  failed`), attempts, last_error, next_at, idempotency_key.
- **`agenda_events`**: kind (`event | milestone | team_event`), title, starts_at,
  ends_at, all_day, time_zone, place, link, audience (`everyone` or team ids), client,
  description, created_by, push_to_gcal, gcal_event_id. **`company_holidays`**.
  **`agenda_external`**: cached Good News events (source id, title, start, end,
  updated).
- **Catalogue**: `tc_jobcodes` gains when_to_use, billable_default, default_company,
  default_project, sort_order; `tc_field_options` gains hidden; a portal-owned flag
  stops the QuickBooks import from overwriting edits.
- **`people_type_changes`**: person_id, to_type, effective_on, scheduled_by, state;
  applied by the cron on the day.
- **Access catalogue**: new keys for the pages (invoices, requests, agenda, reports,
  catalogue, integrations), and the capabilities `inv-approve` ("Approves invoices"),
  `finance` ("Marks invoices and reimbursements paid") and `money` ("Sees pay and
  invoices"; never Team Leaders).

## 4. Deep dive

### Routing (pure, tested): `lib/clocky/routing.ts`

```
hoursApprover(p)   = p.reportsTo                       // null for the Deputy Director
invoiceApprover(p) = invoiceApprovers.includes(p.reportsTo) ? p.reportsTo : superApprover
oneStep(p)         = !p.isContractor || hoursApprover(p) === invoiceApprover(p) || p.paysAs === 'fixed_no_timesheet'
currentOwner(s)    = state submitted: oneStep ? invoiceApprover|hoursApprover : hoursApprover
                     state hours_approved: invoiceApprover
```

Settings give `invoiceApprovers` (Arnaldo, Dave), `superApprover` (Arnaldo) and the
Deputy Director (Dave). The list's "Waiting for you" is `currentOwner === me` (plus
the Super Admin queues); "With others" is everything visible whose owner is someone
else.

### Submit, approve, return

- Submit (contractor): one transaction-like sequence on the server: submission
  `submitted`, invoice made (`waiting`, lines frozen, approved reimbursements moved
  to `on_invoice`), event `submitted`, bell to the current owner.
- Approve hours (two steps): `hours_approved`, event; bell to the invoice approver.
- Approve invoice / both: submission `approved`, invoice `approved`, entries
  `approved`; over-allowance requires a note (stored on the event).
- Employee approve: `approved`, outbox `rippling_hours`.
- Return (any step): submission `returned`, invoice `draft`, reimbursements back to
  `approved`, entries `open`; bell to the person and everyone who approved.
- Every write is claimed with a state guard (`.eq('state', from)`), as part 1 does.

### Integrations

Adapters `lib/integrations/rippling.ts` and `google-calendar.ts` behind one
interface; the outbox worker (cron every 5 minutes, and "Try again") sends queued
jobs with an idempotency key, backs off, and marks `failed` with the provider's
message. With no credentials, jobs wait as `waiting_connection` and the screens
show "Rippling is not connected yet". Exact Rippling endpoints and fields are
confirmed when the token exists (open question 1).

### PDF

The existing `PdfPreview` window: every invoice, RMB document and report export
opens a preview first, Download second. The invoice style is the chosen 1a + 1b
mix (README_PART2 "Invoice / PDF style").

### Cron jobs (deploy/cron)

As built (deploy/cron/portal.crontab, all three lines commented until Clocky goes
to production):

- `clocky-invoices`, day 1, 11:00 UTC: fixed, no-timesheet invoices for the
  previous month.
- `clocky-outbox`, every 5 minutes: Rippling and Google Calendar jobs, then the Good
  News Calendar read into `agenda_good_news` (15 minutes at most between reads).
- `clocky-reminders`, hourly: scheduled contractor-to-employee changes first; then,
  at 9:00 in each person's zone, due / pay period ends / late; the allowance at 90%
  and over; at 7:00 in each person's zone, today's birthdays.

## 5. Scale and reliability

Tiny load: no caching beyond what Next does. The risks are double actions (state
guards), partial failures (outbox, retries, visible errors) and money leaking to the
wrong level (one capability check per money read, a test per page in the access
coverage test).

## 6. Trade-offs

| Decision | Chosen | Because | Cost |
|---|---|---|---|
| Invoice lines | Frozen snapshot | An approved invoice must never change when rates or entries change | Remade on return; a rate fix needs a return |
| Pay terms | Effective-dated table | Rates change mid-year; old invoices keep their numbers | One more join |
| Integrations | Outbox + worker | Decisions never wait on Rippling or Google; retries are visible | A cron and a table |
| Approvers | Settings, not hard-coded names | Arnaldo/Dave can change without code | A settings screen (13B exists in the design) |
| Money privacy | App-code gate + privileged reads | Same as the rest of the portal | Every money read needs the check |

## 7. Build order (each phase on staging, then the next)

1. Data and routing: migrations 115+ (pay terms, submissions, approval events,
   invoices, settings, capabilities), routing module and tests, Rates & Costs "Pays
   as" and allowance, person page Work tab (10A).
2. Approvals list (AP family) and the 6C page family.
3. Invoices: created on submit, day-1 fixed ones, 6E/6F/6G, PDF, Payments tab (10P).
4. Requests: time off (7), reimbursements (9), extra hours (10C to 10E), allowance
   lines (10B), outbox and the two adapters.
5. Agenda (8), Job catalogue (11), Reports (12), Settings (13), contractor to
   employee (10A-3/4).
6. Full audit: every screen, modal, popup and button (as on Oct 20).

## 8. Open questions (do not block the build)

1. **Rippling:** API access on the current plan, who holds the admin login, and the
   token (entered in Settings > Integrations).
2. **Google Calendar:** replaced by the owner's plan of 2026-10-23 (below, "After the
   handoff review", task B): everyone connects their own Google accounts by OAuth.
3. **Invoice rates:** hourly invoice rate = the cost rate (`people.internal_rate`)?
   Only one active person has it on staging; Rates & Costs needs them filled.
4. **Reports to:** 30 of 31 active people have it; confirm it is current.
5. **Company holidays:** the portal uses the US federal list (`usHolidays`). The
   design also shows Day after Thanksgiving and Christmas Eve: confirm the list.
6. **Agenda events:** no edit or delete was designed; a wrong event stays until one
   is added. Team events cannot be shared with other teams yet (the card's
   "greyed when shared" has no control in 8E).
7. **Birthday card:** "Say happy birthday in Chat" is left out while Chat is
   "soon"; it comes back with Chat.
8. **Job catalogue before the switch-over:** QuickBooks Time's import keeps adding
   new jobs and options, but no longer overwrites what a Super Admin edited here.

### After the handoff review (owner, 2026-10-23)

To do once the screen-by-screen review of the part 2 handoff is finished, in this order
unless the owner says otherwise. **The review finished on 2026-10-24**: every screen from
6A to 13C compared with the prototype on desktop and at 390px, the approved fixes on
staging (last 4f2ccc4); production untouched.

**A. The Agenda on a phone: done 2026-10-23 (owner approved).** The handoff has no
phone design for the Agenda. On a phone the month shows each day with one coloured dot
per kind (the chips' colours), the day tapped (today at first, the 1st in another month)
is listed under the calendar like the List view, and the filter chips sit in one row
that scrolls sideways. The desktop is unchanged.

**B. Google Calendar by OAuth, more than one account per person.**
- Everyone can connect their own Google Calendar to the portal with Google sign-in
  (OAuth), and may connect more than one Google account.
- The Agenda holds True North's official events, PTO, events and milestones, and
  meetings.
- The company calendars are connected by a Super Admin. In the create / edit event
  window, the Super Admin sets who can see each event.
- Each person does the same with their own connections: chooses which of their Google
  calendars come in and who can see those events.
- Event types with their own icon (Meeting, Celebration, Training, Deadline...) in the
  New event window, designed together with the above (owner, 2026-10-23). Today the
  window has Event or Milestone only; company or team comes from who creates it.
- To confirm when this starts: on 2026-10-22 the owner said everyone sees every event
  and only Super Admins and Admins edit or delete them; visibility is now set per
  event. Edit and delete rights stay as decided unless the owner changes them.

## 9. As built (staging, October 2026)

| Step | Commit | What |
|---|---|---|
| 1 | 1af455b | Pay terms, approval routing, person page, Rates & Costs |
| 2 | 28d4776 | Approvals by routing, the timesheet + invoice page |
| 3 | e076d7e | Invoices, Mark paid, PDFs, the Submit block, Payments tab |
| 4 | 37499a1 | Requests (time off, reimbursements, extra hours), the outbox |
| 5a | d72f69d | Company settings 13A to 13C, reminders, contractor to employee |
| 5b | 11a6215 | Agenda 8A to 8F, birthday bell |
| 5c | cc02bae | Job catalogue 11A to 11D, "Which job?" |
| 5d | c7863f8 | Reports 12A to 12C |
| audit | 8f8e556 | Dead code out; no-timesheet lock note; reimbursement currencies |

Every frame of the handoff has a design check at
`/design-check/clocky-app?frame=<code>` (and `/design-check/clocky-clock` for the
clock panel), measured against the prototype.

### Going to production (only when the owner asks)

1. Migrations 115 to 122, in order, on the production database (122: several receipts in one reimbursement request, 2026-10-23).
2. The code (promote the staging image).
3. Uncomment the three crontab lines (`clocky-invoices`, `clocky-outbox`,
   `clocky-reminders`) and install the crontab.
4. In Company settings: the invoice numbering and billing details (13B), the
   Rippling token and the Google service account and calendars (13A), and the
   reminders (13C).

