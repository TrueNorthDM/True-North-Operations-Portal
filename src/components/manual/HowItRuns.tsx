/**
 * The System manual's "How it runs" tab: where the portal runs and how it is
 * looked after (the server and its accounts, staging and promoting, alerts,
 * backups, people, troubleshooting, keys). Written for whoever develops and
 * owns the portal, never for one person by name.
 *
 * The same text lives as a standalone page in docs/owner-manual/index.html;
 * change both together. Text runs the full width of its column on purpose.
 *
 * A server component, so the text (the server, its accounts, where the keys
 * live) is sent only in the page of someone the manual is open to, never in a
 * script file anyone could fetch. Only the contents list (RunsToc) runs in the
 * browser.
 */

import { RunsToc } from './RunsToc'


const ACTIONS = 'https://github.com/TrueNorthDM/True-North-Operations-Portal/actions'

// ── Building blocks ──────────────────────────────────────────────────
const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm'
const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div className="font-(family-name:--font-display) font-extrabold text-[11px] uppercase tracking-[.09em] text-tn-teal mb-2">{children}</div>
)
const Heading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="font-(family-name:--font-display) font-extrabold text-[22px] text-tn-ink mb-3">{children}</h2>
)
const Sub = ({ children }: { children: React.ReactNode }) => (
  <h3 className="font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink mt-5 mb-2">{children}</h3>
)
const P = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <p className={`text-[14.5px] leading-[1.7] text-foreground ${className}`}>{children}</p>
)
const B = ({ children }: { children: React.ReactNode }) => <strong className="font-bold text-tn-ink">{children}</strong>
const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="text-tn-teal font-semibold hover:underline">{children}</a>
)
const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="font-mono text-[12.5px] bg-subtle rounded px-1.5 py-0.5 break-all">{children}</code>
)
const Note = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-tn-accent bg-[#fbf1cf] px-4 py-3 text-[14px] leading-relaxed text-foreground">{children}</div>
)
const Callout = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl bg-tn-teal-soft px-4 py-3 text-[14px] leading-relaxed text-foreground">{children}</div>
)

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full min-w-[640px] text-[13.5px] border-collapse">
        <thead>
          <tr>
            {head.map(h => (
              <th key={h} className="text-left bg-subtle font-(family-name:--font-display) font-extrabold text-[10.5px] uppercase tracking-[.08em] text-muted px-4 py-2.5 border-b border-slate-200 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i > 0 ? 'border-t border-slate-100' : ''}>
              {r.map((c, j) => (
                <td key={j} className={`px-4 py-3 align-top leading-relaxed ${j === 0 ? 'font-bold text-tn-ink' : 'text-foreground'}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((it, i) => (
        <li key={i} className="grid grid-cols-[30px_1fr] gap-3 items-start">
          <span className="w-7 h-7 rounded-full border border-tn-accent bg-[#fbf1cf] grid place-items-center font-(family-name:--font-display) font-black text-[13px] text-tn-ink">{i + 1}</span>
          <P className="pt-0.5">{it}</P>
        </li>
      ))}
    </ol>
  )
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 flex flex-col gap-1.5 text-[14.5px] leading-[1.7] text-foreground marker:text-tn-teal">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  )
}

// ── The picture: how the pieces fit ──────────────────────────────────
const BOX = { fill: '#ffffff', stroke: '#9aa6b5', strokeWidth: 1.25 }
const N = { fontFamily: 'var(--font-raleway), sans-serif', fontWeight: 800, fontSize: 14, fill: '#012358' }
const S = { fontFamily: 'var(--font-open-sans), sans-serif', fontSize: 11.5, fill: '#7c8a9c' }
const L = { fontFamily: 'var(--font-open-sans), sans-serif', fontSize: 11.5, fill: '#435066' }
const EDGE = { fill: 'none', stroke: '#9aa6b5', strokeWidth: 1.25 }
const GOLD = { fill: 'none', stroke: '#F2C40A', strokeWidth: 2 }
const Box = ({ x, y, w = 200, name, sub, hot = false, dashed = false }: { x: number; y: number; w?: number; name: string; sub: string; hot?: boolean; dashed?: boolean }) => (
  <g>
    <rect x={x} y={y} width={w} height={60} rx={8} {...BOX} {...(hot ? { fill: '#eaf4f4', stroke: '#1E7D7F', strokeWidth: 2 } : {})} strokeDasharray={dashed ? '5 4' : undefined} />
    <text x={x + w / 2} y={y + 25} textAnchor="middle" {...N}>{name}</text>
    <text x={x + w / 2} y={y + 44} textAnchor="middle" {...S}>{sub}</text>
  </g>
)

function Diagram() {
  return (
    <div className={`${card} p-3 overflow-x-auto`}>
      <svg viewBox="0 0 760 620" role="img" aria-label="Every change lands on staging first and is promoted to production" className="block w-full min-w-[560px] h-auto">
        <defs>
          <marker id="hir-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#9aa6b5" /></marker>
          <marker id="hir-g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#F2C40A" /></marker>
        </defs>
        <path d="M224 54H280" {...GOLD} markerEnd="url(#hir-g)" />
        <path d="M380 84V252" {...GOLD} markerEnd="url(#hir-g)" />
        <path d="M340 312V352" {...GOLD} markerEnd="url(#hir-g)" />
        <path d="M124 84V216" {...EDGE} strokeDasharray="4 4" markerEnd="url(#hir-a)" />
        <path d="M628 84V120" {...EDGE} markerEnd="url(#hir-a)" />
        <path d="M628 180V332H430V352" {...EDGE} markerEnd="url(#hir-a)" />
        <path d="M628 282H480" {...EDGE} markerEnd="url(#hir-a)" />
        <path d="M240 382H280" {...EDGE} markerStart="url(#hir-a)" markerEnd="url(#hir-a)" />
        <path d="M628 412V536" {...EDGE} markerEnd="url(#hir-a)" />
        <path d="M380 488V536" {...EDGE} markerEnd="url(#hir-a)" />

        <Box x={24} y={24} name="Developers + Claude" sub="Claude Code, on their Mac" />
        <Box x={280} y={24} name="GitHub" sub="TrueNorthDM: the code" />
        <Box x={528} y={24} name="Team" sub="in the browser" />
        <Box x={528} y={120} name="Cloudflare" sub="both addresses" />

        <text x={252} y={44} textAnchor="middle" {...L}>push</text>
        <text x={390} y={142} {...L}>every push,</text>
        <text x={390} y={158} {...L}>about 5 minutes</text>
        <text x={134} y={142} {...L}>SSH: Claude looks</text>
        <text x={134} y={158} {...L}>after the server</text>
        <text x={554} y={274} textAnchor="middle" {...L}>staging.</text>
        <text x={532} y={324} textAnchor="middle" {...L}>main address</text>
        <text x={330} y={338} textAnchor="end" {...L} fontWeight={700}>promote</text>

        <rect x={24} y={216} width={712} height={288} rx={8} fill="#f6f4ee" stroke="#9aa6b5" strokeWidth={1.25} />
        <text x={40} y={241} {...N}>ScalaHosting server · 174.136.29.221</text>
        <text x={40} y={276} {...S}>STAGING</text>
        <text x={40} y={292} {...S}>a copy to try changes on</text>
        <Box x={280} y={252} name="Staging copy" sub="portal + its own database" dashed />
        <text x={40} y={344} {...S}>PRODUCTION</text>
        <Box x={40} y={352} name="Supabase" sub="database, sign-in and files" />
        <Box x={280} y={352} name="Portal" sub="the screens the team uses" hot />
        <Box x={536} y={352} w={184} name="Scheduled jobs" sub="Syncs every 4 h, emails 8:00" />
        <Box x={40} y={428} name="Backups" sub="every night, 03:30" />
        <Box x={280} y={428} name="Watch" sub="checks every 10 min" />

        <Box x={280} y={536} name="Resend" sub="sign-in, invites, alerts" />
        <Box x={536} y={536} w={184} name="Monday and TSheets" sub="project data and hours" />
        <text x={388} y={522} {...L}>emails</text>
        <text x={636} y={522} {...L}>reads the data</text>
      </svg>
    </div>
  )
}

// ── The tab ──────────────────────────────────────────────────────────
export function HowItRuns() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[214px_1fr] gap-10 items-start">
      <RunsToc />

      <div className="min-w-0 flex flex-col gap-11">
        <section id="runs-overview" className="scroll-mt-6 flex flex-col gap-4">
          <div>
            <Eyebrow>Overview</Eyebrow>
            <Heading>Where the portal runs</Heading>
            <P>The portal runs on True North&apos;s own server at ScalaHosting, at <A href="https://truenorthportal.online">truenorthportal.online</A>. Everything runs on that one server, in two copies: staging, where every change lands first, and production, the portal the team uses. A developer asks Claude for a change, Claude saves it to GitHub, GitHub puts it on staging in about 5 minutes, and once it has been tried there it is promoted to production. The gold path in the picture is that journey.</P>
          </div>
          <Diagram />
          <P>The team reaches both copies through Cloudflare, and Claude looks after the server over SSH. Monday also tells the portal when a board changes, through the webhooks on the AAAF and HFA boards.</P>
        </section>

        <section id="runs-accounts" className="scroll-mt-6 flex flex-col gap-4">
          <div>
            <Eyebrow>Accounts</Eyebrow>
            <Heading>Who holds each piece</Heading>
            <P>Every piece of the portal lives in a True North account. None depends on anyone&apos;s personal account, except where the table says so.</P>
          </div>
          <Table
            head={['Service', 'What it does', 'Account', 'Where to sign in']}
            rows={[
              ['ScalaHosting', 'The server (VPS 174.136.29.221) that runs the portal, the database and the backups', 'Client: Wendy\'s account. The portal\'s developers are contacts on it: they can open tickets, but cannot see the support PIN', <span key="s"><A href="https://my.scalahosting.com">my.scalahosting.com</A> and SPanel</span>],
              ['Cloudflare', 'The truenorthportal.online address: DNS, certificate and protection', 'office@truenorthdigitalmarketing (2FA on)', <A key="c" href="https://dash.cloudflare.com">dash.cloudflare.com</A>],
              ['GoDaddy', 'Where the domain was bought and is renewed', 'True North (Wendy)', 'godaddy.com'],
              ['GitHub', 'The portal\'s code (TrueNorthDM) and the dated copies of the COE tools (TrueNorthDM-Archive)', 'truenorthdigitalmarketing, owner of both organizations', <A key="g" href="https://github.com/TrueNorthDM">github.com/TrueNorthDM</A>],
              ['Resend', 'Sends the emails: sign-in codes, invitations and alerts', 'truenorthdigitalmarketing team. Keys: Portal server and Uptime check (GitHub)', <A key="r" href="https://resend.com">resend.com</A>],
              ['Monday', 'Projects, boards and My Work. The portal reads the boards and receives the AAAF and HFA webhooks', 'The token lives in the portal: Admin, Company settings', 'monday.com'],
              ['QuickBooks Time', 'The hours (TSheets), which the portal pulls every 4 hours', 'The token lives in the portal: Admin, Company settings', 'QuickBooks Time'],
              ['Vercel', 'Only the old address\'s redirect and the move status page', 'A personal Vercel team that also holds other, unrelated projects', <A key="v" href="https://vercel.com">vercel.com</A>],
              ['Google Workspace', 'The GoodNews email addresses people sign in to the portal with', 'GoodNews (Wendy is IT)', 'admin.google.com'],
              ['Claude', 'Makes the code changes and looks after the server, from a developer\'s Mac', 'The developer\'s Claude account', 'Claude app, Code tab, TN Op Portal project'],
            ]}
          />
          <Note><B>Open question:</B> when the domain registration at GoDaddy expires. Worth confirming with Wendy and turning on auto-renew.</Note>
        </section>

        <section id="runs-publish" className="scroll-mt-6 flex flex-col gap-4">
          <div>
            <Eyebrow>Releases</Eyebrow>
            <Heading>Publishing a change</Heading>
            <P>Every change goes through Claude, lands on the staging copy first and reaches the team only when it is promoted. A developer does this:</P>
          </div>
          <Steps items={[
            <>Open the Claude app, <B>Code</B> tab, in the <B>TN Op Portal</B> project.</>,
            'Describe the change. For a large, visible change, Claude shows how it will look first and asks before publishing.',
            'Claude changes the code and runs the checks: the type check and about 900 automated tests.',
            <>Claude saves the change (commit) and sends it to GitHub (push), always on the <B>main</B> branch. It is the only branch.</>,
            <>GitHub runs &quot;Deploy to staging&quot;: in about 5 minutes the change is on <A href="https://staging.truenorthportal.online">staging.truenorthportal.online</A>, with a yellow strip on every page.</>,
            'Try the change on staging. Anything done there stays there.',
            <>To publish, tell Claude to promote it, or in the <A href={ACTIONS}>Actions tab</A> open &quot;Promote to production&quot;, click <B>Run workflow</B> and enter the commit tested on staging. About 5 minutes later it is live. If the new version does not answer, the server goes back to the previous one on its own.</>,
          ]} />
          <P><B>Database changes</B> (migrations) are applied by Claude on the server: on staging first, then on production when the change is promoted.</P>
          <P><B>Rolling back:</B> ask Claude. Or, in the Actions tab, open &quot;Promote to production&quot;, click <B>Run workflow</B> and enter the code (sha) of an earlier commit.</P>
        </section>

        <section id="runs-staging" className="scroll-mt-6 flex flex-col gap-4">
          <div>
            <Eyebrow>Test copy</Eyebrow>
            <Heading>Staging</Heading>
            <P><A href="https://staging.truenorthportal.online">staging.truenorthportal.online</A> is a full copy of the portal, with its own database holding a copy of production&apos;s data. Every change lands there first, and nothing done there reaches the team.</P>
          </div>
          <Table
            head={['', 'Production', 'Staging']}
            rows={[
              ['Address', 'truenorthportal.online', 'staging.truenorthportal.online, with a yellow strip on every page'],
              ['Who uses it', 'The whole team', 'Developers and whoever is testing a change'],
              ['Gets a new version', 'When a tested commit is promoted', 'On every push, in about 5 minutes'],
              ['Data', 'The real data', 'A copy of production\'s, from the last refresh'],
              ['Signing in', 'Email code and 2FA', 'The same accounts and 2FA, from the last refresh. Codes come from "True North Operations Portal (staging)"'],
              ['Emails the portal sends (invitations)', 'To everyone', 'Only to the owner'],
              ['Monday and TSheets syncs, Monday webhooks', 'Yes', 'No'],
              ['Backups and alerts', 'Yes', 'No'],
            ]}
          />
          <Bullets items={[
            <><B>Try a change:</B> open staging in a private window after Claude says the change is on staging, and use the portal as the team would.</>,
            <><B>Publish it:</B> tell Claude to promote it, or use &quot;Promote to production&quot; in the GitHub Actions tab.</>,
            <><B>Fresh data:</B> ask Claude to refresh staging. It copies last night&apos;s backup, or a backup taken on the spot, into staging. Production is only read.</>,
            <><B>Something on staging looks wrong:</B> don&apos;t promote. Tell Claude what you saw; the fix lands on staging again first.</>,
          ]} />
        </section>

        <section id="runs-monitoring" className="scroll-mt-6 flex flex-col gap-4">
          <div>
            <Eyebrow>Alerts</Eyebrow>
            <Heading>Checking everything is fine</Heading>
            <P>Nobody needs to look at anything every day. If something goes wrong, an alert email goes to the portal owner. No email means everything is working.</P>
          </div>
          <Table
            head={['Watcher', 'Looks from', 'Every', 'What it checks', 'How it alerts']}
            rows={[
              ['Server watch', 'Inside the server', '10 min', 'The 9 services running; the portal and sign-in answering; more than 10 GB free; last night\'s backup less than 26 hours old', 'An email from "Portal server" when a problem starts and when it clears'],
              ['Uptime check', 'Outside, from GitHub\'s machines', '1 hour', 'The portal opens; the database answers; the old address still redirects', 'An email after a second try, 1 minute later'],
              ['Integration health', 'Inside the portal', '2 days', 'The Monday token, the Monday webhooks, TSheets', 'A banner in Admin and the Admin, Automations screen'],
            ]}
          />
          <P>The server watch cannot send an alert if the whole server goes down. That is why the Uptime check looks from outside. Staging is not watched: the alerts are about production only.</P>
          <Sub>Where to look</Sub>
          <Bullets items={[
            <><B>In the portal:</B> Admin, Automations shows every scheduled job and webhook, with its last check.</>,
            <><B>On GitHub:</B> the <A href={ACTIONS}>Actions tab</A> shows the deploys and the hourly checks.</>,
            <><B>In Resend:</B> the Logs screen shows every email sent. Use it to see whether someone&apos;s sign-in code went out.</>,
          ]} />
        </section>

        <section id="runs-backups" className="scroll-mt-6 flex flex-col gap-4">
          <div>
            <Eyebrow>Safety net</Eyebrow>
            <Heading>Backups</Heading>
            <P>Every night at 03:30 (US Eastern), the server keeps three copies. A restore was tested on October 5 with the real data, and all 94 tables came back identical.</P>
          </div>
          <Table
            head={['What', 'Contents', 'Kept for']}
            rows={[
              ['Exact database copy', 'The database files as they are. This is the one used to restore', '14 days'],
              ['Database as SQL', 'The same database as readable text', '30 days'],
              ['Uploaded files', 'Profile photos and documents people upload to the portal', '30 days'],
              ['Final copy of the old Supabase', 'The database as it was on moving day, October 5', 'Forever'],
            ]}
          />
          <P>The backups live in <Code>/home/tnportal/portal-backups</Code> on the server. That folder is part of ScalaHosting&apos;s own daily backup, so every night is also kept off the server. Staging has no backups of its own: its data is a copy of production&apos;s, refreshed on request.</P>
          <P><B>Restoring:</B> ask Claude and say which day. The procedure is in <Code>deploy/README.md</Code>, Backups section.</P>
          <Callout><B>The code</B> does not depend on these backups: it lives on GitHub with its whole history. The COE tools have a frozen copy from October 6 in TrueNorthDM-Archive.</Callout>
        </section>

        <section id="runs-people" className="scroll-mt-6 flex flex-col gap-4">
          <div>
            <Eyebrow>Access</Eyebrow>
            <Heading>People</Heading>
            <P>Only people an admin invited can sign in to the portal, always with their GoodNews email, and everyone uses 2FA. On GitHub, only people the owner invites to TrueNorthDM get in, and each sees only the repositories opened to them.</P>
          </div>
          <Sub>In the portal</Sub>
          <Table
            head={['To', 'Where', 'Note']}
            rows={[
              ['Invite someone', 'Directory, Portal access tab: tick the person and click Invite', 'They get an email with a sign-in button. The invitation does not expire'],
              ['Remove access', 'The person\'s page, Work: make them inactive; or HR and access: Revoke the invitation', 'Their sessions end at once'],
              ['Reset 2FA', 'The person\'s page, HR and access, Two-step: Reset', 'For a lost phone. They set it up again at their next sign-in. Super Admins only (Reset someone\'s two-step sign-in, on Access levels). With the phone in hand, they move it themselves: Settings, Sign-in and security'],
              ['See who has 2FA', 'Directory, Portal access tab, Two-step column', ''],
            ]}
          />
          <P>Sign-in rules: a 6-digit code by email, then the code from the authenticator app. A session lasts up to 2 months, or 15 days without use. People signing in for the first time have 7 days to set up 2FA. On staging, people and invitations are those of production at the last refresh; inviting someone or resetting 2FA there changes only staging.</P>
          <Sub>On GitHub</Sub>
          <Bullets items={[
            <><B>Invite:</B> in <A href="https://github.com/orgs/TrueNorthDM/people">People</A>, click Invite member, use the email or username and choose <B>Member</B>, never Owner.</>,
            <><B>Open a repository to someone:</B> in the repository, Settings, Collaborators and teams, Add people. <B>Read</B> only sees the code; <B>Write</B> can send code.</>,
            <><B>Remove access:</B> in People, click the person, then Remove from organization. It cuts everything at once.</>,
            <><B>Never</B> share the truenorthdigitalmarketing login. That account owns everything.</>,
          ]} />
          <P>The organization is locked down: new members see nothing until a repository is opened to them, they cannot create or copy repositories, and GitHub 2FA is required.</P>
        </section>

        <section id="runs-trouble" className="scroll-mt-6 flex flex-col gap-4">
          <div>
            <Eyebrow>Troubleshooting</Eyebrow>
            <Heading>When something breaks</Heading>
            <P>When in doubt, open Claude in the TN Op Portal project and describe what you saw, with the screenshot or the email text. Claude connects to the server and investigates.</P>
          </div>
          <Table
            head={['What happened', 'First look at', 'What to do']}
            rows={[
              ['A "Portal server" email about a problem', 'Whether a later email says it cleared', 'If it has not cleared in 20 minutes, send the email to Claude'],
              ['An Uptime check email: the portal does not open', 'Whether the portal opens in your browser', 'Send it to Claude. If the whole server is down, open a chat or ticket with ScalaHosting (Wendy has the PIN)'],
              ['Someone does not get their sign-in code', 'Their spam folder; the Logs screen in Resend', 'If the sign-in page said "hasn\'t been invited", invite them in the Directory'],
              ['Someone lost or changed their phone', '', 'Changed: they use Move to a new phone in their Settings. Lost: a Super Admin resets it on their page, HR and access'],
              ['My Work or the Monday reports stopped updating', 'Admin, Automations', 'Send it to Claude. If the Monday token expired, create a new one in Monday and paste it in Admin, Company settings'],
              ['New hours do not show up', 'They arrive every 4 hours', 'If it takes longer, tell Claude. If the QuickBooks Time token expired, paste the new one in Admin, Company settings'],
              ['A change looks wrong on staging', 'The yellow strip, to be sure it is staging', 'Don\'t promote it. Tell Claude what you saw'],
              ['Something broke right after a promote', 'Whether staging shows the same problem', 'Ask Claude to roll back, or promote the previous commit in the Actions tab'],
              ['A PDF or image export fails', '', 'Send Claude the report and the month'],
              ['A low disk space alert', '', 'Ask Claude to free up space. If that is not enough, the ScalaHosting plan needs to grow'],
              ['The portal needs a maintenance pause', '', 'Ask Claude: it turns the maintenance page on, and off again afterwards'],
            ]}
          />
          <P><B>ScalaHosting support:</B> chat at <A href="https://my.scalahosting.com">my.scalahosting.com</A> or a ticket under Support. Give them the server IP, 174.136.29.221. On chat they ask for the account PIN, which only Wendy can see; a ticket opened while signed in does not need it.</P>
        </section>

        <section id="runs-keys" className="scroll-mt-6 flex flex-col gap-4">
          <div>
            <Eyebrow>Security</Eyebrow>
            <Heading>Keys and access</Heading>
            <P>Two keys on the developer&apos;s Mac are Claude&apos;s way into the server and GitHub. If that Mac is lost, they can be replaced, but it takes a day of support. Keep a copy in a password manager.</P>
          </div>
          <Table
            head={['Key', 'Where it lives', 'What it opens', 'If lost']}
            rows={[
              ['Server key', <span key="k1"><Code>~/.ssh/truenorth_vps</Code>, on the developer&apos;s Mac</span>, 'The server, as administrator (port 6543; key only, never a password)', 'ScalaHosting installs a new key, by ticket'],
              ['GitHub deploy key', <span key="k2"><Code>~/.ssh/truenorthdm_portal_deploy</Code>, on the developer&apos;s Mac</span>, 'Only the portal repository, to send code', 'Claude makes a new one, and the owner adds it to the repository (Settings, Deploy keys)'],
              ['Portal secrets', <span key="k3">On the server: <Code>/opt/tnportal/portal.env</Code> and <Code>/opt/tnportal/supabase/.env</Code></span>, 'Database, sign-in, sending email', 'They exist only on the server and in its backups'],
              ['Staging secrets', <span key="k4">On the server: <Code>/opt/tnportal/staging.env</Code> and <Code>/opt/tnportal/supabase-staging/.env</Code></span>, 'Staging\'s own database, sign-in keys and email limit', 'Recreate them with Claude'],
              ['GitHub secrets', <span key="k5">Portal repository, Settings, Secrets: <Code>SERVER_SSH_KEY</Code> and <Code>RESEND_API_KEY</Code></span>, 'The deploys (that key can only publish) and the Uptime check email', 'Recreate them with Claude'],
              ['Monday and QuickBooks Time tokens', 'In the portal: Admin, Company settings', 'Reading the boards and the hours', 'Create a new one in the service and paste it there'],
            ]}
          />
          <Callout><B>A secret never goes in the chat.</B> When Claude needs one, it gives the developer a command to run in Terminal: they paste the secret there, it goes straight into a protected file, and Claude uses it without seeing it.</Callout>
          <Sub>Keep somewhere safe</Sub>
          <Bullets items={[
            'The 2FA recovery codes for the truenorthdigitalmarketing GitHub account',
            'The 2FA recovery codes for Cloudflare',
            'A copy of the two keys on the developer\'s Mac, in a password manager',
            'Consider Wendy as a second owner of TrueNorthDM, as a backup only',
          ]} />
        </section>

        <section id="runs-local" className="scroll-mt-6 flex flex-col gap-4">
          <div>
            <Eyebrow>Development</Eyebrow>
            <Heading>Running the portal locally</Heading>
            <P>Since October 5, the portal no longer runs on a developer&apos;s Mac (<Code>npm run dev</Code>): the local settings pointed at the old Supabase, which was deleted. Staging now covers most of what running locally was for: every change can be tried there before the team sees it. A local copy is only worth it for quick experiments that should not even reach staging.</P>
          </div>
          <Table
            head={['Option', 'What it is', 'Risk']}
            rows={[
              ['Local copy (recommended)', 'A Supabase on the Mac with last night\'s copy of the data. Needs Docker Desktop', 'None: nothing done there reaches the real portal'],
              ['Point at the server', 'The portal on the Mac uses the server\'s database', 'High: every click writes to the team\'s real data'],
            ]}
          />
          <P>To set up the local copy, ask Claude: &quot;set up the local environment with a copy of the data&quot;.</P>
        </section>

        <section id="runs-glossary" className="scroll-mt-6 flex flex-col gap-4">
          <div>
            <Eyebrow>Words</Eyebrow>
            <Heading>Glossary</Heading>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {[
              ['Branch', 'A line of work in the code. The portal uses only main.'],
              ['Commit', 'A change saved to the code\'s history, with a date and a description.'],
              ['Container', 'An isolated box on the server that runs one program: the portal, the database, sign-in.'],
              ['Cron', 'A job the server runs on its own at a set time.'],
              ['Deploy', 'Putting a new version of the portal on staging or production.'],
              ['DNS', 'The directory that says which server an address leads to. Ours is at Cloudflare.'],
              ['Docker', 'The program that runs the containers.'],
              ['Migration', 'A change to the database\'s structure.'],
              ['Organization', 'The company\'s space on GitHub, with members and permissions.'],
              ['Production', 'The portal the team uses, at truenorthportal.online.'],
              ['Promote', 'Putting a version that was tried on staging onto production.'],
              ['Proxy', 'The doorman that receives visitors to an address and hands them to the portal.'],
              ['Pull request', 'A request to merge a branch into main, reviewed first.'],
              ['Push', 'Sending the commits made on the Mac to GitHub.'],
              ['Repository', 'A project\'s folder on GitHub, with its whole history.'],
              ['SSH', 'The secure way into the server from the command line.'],
              ['Staging', 'The test copy of the portal, at staging.truenorthportal.online, with a copy of the data.'],
              ['Supabase', 'The set of services that gives the portal its database, sign-in and files. It runs inside our server.'],
              ['Token', 'A password for programs, giving access to a service.'],
              ['VPS', 'A server rented just for us. Ours is at ScalaHosting.'],
              ['Webhook', 'An automatic notice a service sends the portal when something changes. Monday does this.'],
              ['2FA', 'The second step of signing in: the code from the authenticator app on the phone.'],
            ].map(([t, d]) => (
              <div key={t} className={`${card} px-4 py-3`}>
                <dt className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{t}</dt>
                <dd className="text-[13.5px] leading-relaxed text-muted mt-0.5">{d}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  )
}
