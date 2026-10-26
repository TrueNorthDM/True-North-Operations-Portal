'use client'

/**
 * The body of the two notification drawers (navigation redesign, 22 September
 * 2026). Full height, anchored right under the top bar, 416px, over a dim
 * layer: not a small popover. Two tabs, each with its unread count; All and
 * Unread; Mark all read; the list; and the way to the notification settings.
 *
 * The bell is the portal talking to you (Tools, System); the message icon is a
 * person talking to you (Chat, Email). They never mix.
 *
 * The bell is fed since 22 September 2026 (src/lib/notifications): the layout
 * reads the person's landed notifications and hands them in as `items`. Chat
 * and Email do not exist yet, so the Messages drawer opens on its empty
 * states. Opening a notification marks it read, and so does "Mark all read",
 * on the server as well as here; which ones are read lives in the button, so
 * its count drops at once.
 *
 * Clocky's rows (16 October 2026, Clock Safety.dc.html frames N1, N3, N4) are
 * drawn as the design draws them: a coloured symbol per kind, the source line
 * on top, the sentence, and one button (Review, Keep going, Confirm end time,
 * Open time entries, Open Clock safety) or, once acted on, what was done.
 */

import Link from 'next/link'
import { withViewAs } from '@/components/ViewAsKeeper'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { NavIcon } from '@/components/NavIcon'
import type { NavIconKey } from '@/lib/nav/nav-icons'
import type { NotificationButton } from '@/lib/notifications/catalogue'
import { BTN } from '@/lib/ui/buttons'
import { markNotificationsRead, markTabRead } from '@/app/(app)/notifications/actions'
import { keepGoing as keepGoingAction } from '@/app/(app)/clocky-hours/clock-actions'

export type DrawerKind = 'bell' | 'inbox'

export interface NotificationItem {
  id: string
  /** The source's name: "Report", "Monday sync", a person. */
  who: string
  what: string
  /** "08:40", "Yesterday". */
  when: string
  /** The small uppercase origin line: "Operations", "i7 mailbox". */
  src: string
  icon: NavIconKey
  href: string
  unread: boolean
  /** Arrived with the daily summary rather than as it happened. */
  summary?: boolean
  /** The type's one button (Clocky: Review, Keep going, Confirm end time...), from the catalogue. */
  button?: NotificationButton
  /** What the person did about it ("You kept going at 12:31 PM. Clocky asks again in 4h 30m."): shown instead of the button. */
  done?: string
  /** The notification type's key ("clocky-stopped"): Clocky's rows are drawn their own way. */
  type?: string
}

/** What "Keep going" answers: the bell's toast, or why it was refused. */
export type KeepGoing = (input: { notificationId: string }) => Promise<{ ok: true; toastFromBell: string; done: string } | { ok: false; error: string }>

/** Where a clock row's "Confirm end time" goes: the top bar opens the clock panel on it. */
export const CLOCK_PANEL_HREF = '/clocky-hours?clock=open'

interface Tab { key: string; label: string; emptyTitle: string; empty: string }

export const DRAWERS: Record<DrawerKind, { title: string; icon: NavIconKey; tabs: [Tab, Tab] }> = {
  bell: {
    title: 'Notifications',
    icon: 'bell',
    tabs: [
      { key: 'tools', label: 'Tools', emptyTitle: 'Nothing from your tools', empty: 'Alerts from the dashboards and reports you can reach land here.' },
      { key: 'system', label: 'System', emptyTitle: 'Nothing from the portal', empty: 'Syncs, health checks and access changes land here.' },
    ],
  },
  inbox: {
    title: 'Messages',
    icon: 'messages',
    tabs: [
      { key: 'chat', label: 'Chat', emptyTitle: 'No unread messages', empty: 'Channels and direct messages land here.' },
      { key: 'email', label: 'Email', emptyTitle: 'No unread email', empty: 'The mailboxes you hold land here.' },
    ],
  },
}

export function NotificationDrawer({ kind, tab, onTab, items, read, onRead, onUnread, onClose, keepGoing = keepGoingAction }: {
  kind: DrawerKind
  tab: string
  onTab: (key: string) => void
  items: Record<string, NotificationItem[]>
  /** Read since the page loaded, kept by the button so its count follows. */
  read: ReadonlySet<string>
  onRead: (ids: string[]) => void
  /** Puts them back to unread: the server did not mark them. */
  onUnread?: (ids: string[]) => void
  onClose: () => void
  /** Design check only: answers "Keep going" without the server. */
  keepGoing?: KeepGoing
}) {
  const router = useRouter()
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  // What was done here before the page had the server's line for it.
  const [doneHere, setDoneHere] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])
  const d = DRAWERS[kind]
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Shown read at once; put back, with the reason, if the server refused
  // (a View Stage preview, a lapsed session).
  const markRead = (ids: string[], save: () => Promise<{ ok: boolean; error?: string }>) => {
    onRead(ids)
    setError(null)
    save().catch(() => ({ ok: false, error: 'Not marked read. Try again in a moment.' })).then(res => {
      if (res.ok) return
      onUnread?.(ids)
      setError(res.error ?? 'Not marked read.')
    })
  }
  const isUnread = (i: NotificationItem) => i.unread && !read.has(i.id)
  const rows = (items[tab] ?? []).filter(i => !onlyUnread || isUnread(i))
  const current = d.tabs.find(t => t.key === tab) ?? d.tabs[0]
  // Focus moves into the drawer when it opens (onto the open tab), and the
  // arrow keys move between tabs (audit, 8 October 2026). Escape and giving
  // focus back are the button's (NotificationButton.tsx).
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true })
  }, [kind])
  // A modal panel: Tab stays inside it while it is open.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const list = [...(box.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]') ?? [])]
    if (!list.length) return
    const first = list[0], last = list[list.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }
  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const at = d.tabs.findIndex(t => t.key === current.key)
    const next = d.tabs[(at + (e.key === 'ArrowRight' ? 1 : -1) + d.tabs.length) % d.tabs.length]
    onTab(next.key)
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>(`#drawer-tab-${next.key}`)?.focus())
  }
  const pill = (on: boolean) => `rounded-full px-[11px] py-1 text-[12px] font-semibold transition-colors ${on ? 'bg-subtle text-tn-ink' : 'text-muted hover:text-tn-ink'}`

  return (
    <>
      <div aria-hidden="true" onClick={onClose} className="fixed inset-x-0 bottom-0 top-[var(--chrome-top)] z-40 bg-[rgba(1,35,88,.16)]" />
      <div ref={box} role="dialog" aria-modal="true" aria-label={d.title} onKeyDown={onKeyDown} className="fixed right-0 bottom-0 top-[var(--chrome-top)] z-40 w-[421px] max-w-full bg-white border-l border-[var(--panel-border)] shadow-[-24px_0_50px_-24px_rgba(1,35,88,.35)] flex flex-col">
        {/* The head and the tabs as the Clocky handoff draws the bell (Clock Safety.dc.html N1). */}
        <div className="pt-4 pr-4 pl-[18px] flex flex-col gap-3 border-b border-[var(--row-rule)] leading-[normal]">
          <div className="flex items-center justify-between">
            <h2 className="font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink m-0" style={{ letterSpacing: 'normal' }}>{d.title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="w-[30px] h-[30px] rounded-[8px] text-muted hover:bg-subtle inline-flex items-center justify-center">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>

          <div role="tablist" aria-label={d.title} onKeyDown={onTabKey} className="flex gap-1">
            {d.tabs.map(t => {
              const on = t.key === current.key
              const count = (items[t.key] ?? []).filter(isUnread).length
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  id={`drawer-tab-${t.key}`}
                  aria-selected={on}
                  aria-controls="drawer-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => onTab(t.key)}
                  className={`flex items-center gap-[7px] px-3 py-2 -mb-px border-b-[2.5px] font-(family-name:--font-display) font-extrabold text-[13px] whitespace-nowrap transition-colors ${on ? 'text-tn-ink border-tn-teal' : 'text-muted border-transparent hover:text-tn-ink'}`}
                >
                  {t.label}
                  <span className={`min-w-[18px] h-[18px] rounded-full px-[5px] inline-flex items-center justify-center text-[10.5px] font-bold ${on ? 'bg-tn-primary text-[#ffffff]' : 'bg-[var(--chip-neutral-bg)] text-muted'}`}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-2.5 border-b border-[var(--row-rule)]">
          <div className="flex gap-1">
            <button type="button" onClick={() => setOnlyUnread(false)} aria-pressed={!onlyUnread} className={pill(!onlyUnread)}>All</button>
            <button type="button" onClick={() => setOnlyUnread(true)} aria-pressed={onlyUnread} className={pill(onlyUnread)}>Unread</button>
          </div>
          <button
            type="button"
            disabled={!(items[current.key] ?? []).some(isUnread)}
            onClick={() => {
              const ids = (items[current.key] ?? []).filter(isUnread).map(i => i.id)
              if (!ids.length) return
              markRead(ids, () => markTabRead(current.key))
            }}
            className="text-[12.5px] font-semibold text-tn-teal hover:text-tn-ink disabled:text-muted disabled:opacity-60"
          >
            Mark all read
          </button>
        </div>

        {error && <p role="alert" className="m-0 px-5 py-2 text-[12.5px] text-[#b3271f] border-b border-[var(--row-rule)]">{error}</p>}

        <div id="drawer-panel" role="tabpanel" aria-labelledby={`drawer-tab-${current.key}`} className="flex-1 overflow-y-auto px-2.5 py-2 flex flex-col gap-0.5">
          {rows.length === 0 ? (
            <div className="px-8 py-14 text-center flex flex-col items-center gap-2">
              <span className="w-11 h-11 rounded-xl bg-subtle text-muted inline-flex items-center justify-center"><NavIcon name={d.icon} size={20} /></span>
              <p className="text-[14px] font-semibold text-tn-ink m-0">{current.emptyTitle}</p>
              <p className="text-[12.5px] text-muted leading-relaxed m-0">{current.empty}</p>
            </div>
          ) : rows.map(i => {
            const unread = isUnread(i)
            if (i.type?.startsWith('clocky-')) {
              return (
                <ClockyRow
                  key={i.id}
                  item={i}
                  unread={unread}
                  done={i.done ?? doneHere[i.id]}
                  busy={busy === i.id}
                  onButton={() => {
                    const b = i.button
                    if (!b) return
                    if (b.action === 'keep-going') {
                      setBusy(i.id)
                      setError(null)
                      keepGoing({ notificationId: i.id }).catch(() => null).then(res => {
                        setBusy(null)
                        // No answer (the connection dropped): nothing changed on the server, so the row stays unread.
                        if (!res) { setError('Not saved. Try again in a moment.'); return }
                        // A refusal: the server already marked an outdated reminder read, so the row reads that way here too.
                        if (!res.ok) { setError(res.error); onRead([i.id]); return }
                        // The server marked the row read and wrote what was done; the refresh brings it.
                        onRead([i.id])
                        setDoneHere(d => ({ ...d, [i.id]: res.done }))
                        setToast(res.toastFromBell)
                        router.refresh()
                      })
                      return
                    }
                    if (unread) markRead([i.id], () => markNotificationsRead([i.id]))
                    onClose()
                    router.push(withViewAs(b.action === 'open-clock' ? CLOCK_PANEL_HREF : (b.href ?? i.href)))
                  }}
                />
              )
            }
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => {
                  if (unread) markRead([i.id], () => markNotificationsRead([i.id]))
                  onClose()
                  router.push(withViewAs(i.href))
                }}
                className={`w-full flex gap-3 px-2.5 py-3 rounded-[11px] text-left transition-colors hover:bg-subtle ${unread ? 'bg-[#f8f7f3]' : 'bg-white'}`}
              >
                <span className={`w-[34px] h-[34px] rounded-[10px] shrink-0 inline-flex items-center justify-center ${unread ? 'bg-[rgba(30,125,127,.12)] text-tn-teal' : 'bg-subtle text-muted'}`}><NavIcon name={i.icon} size={17} /></span>
                <span className="flex-1 min-w-0 flex flex-col gap-[3px]">
                  <span className="flex justify-between items-baseline gap-2">
                    <span className="flex items-baseline gap-1.5 min-w-0">
                      {unread && <span className="w-[7px] h-[7px] rounded-full bg-tn-teal shrink-0 -translate-y-px" />}
                      {/* Wraps rather than truncates: a notification's title is its message. */}
                      <span className="text-[13.5px] font-bold text-tn-ink leading-snug">{i.who}</span>
                    </span>
                    <span className="text-[11.5px] text-muted tabular-nums lining-nums whitespace-nowrap">{i.when}</span>
                  </span>
                  <span className="text-[12.5px] text-foreground leading-normal">{i.what}</span>
                  <span className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10.5px] font-bold tracking-[.06em] uppercase text-muted">{i.src}</span>
                    {i.summary && <span className="rounded bg-subtle px-[5px] py-px text-[9.5px] font-bold tracking-[.05em] uppercase text-muted">Daily summary</span>}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        {toast && (
          <div role="status" className="fixed left-1/2 bottom-6 -translate-x-1/2 z-[90] flex items-center gap-3 w-max max-w-[calc(100%-32px)] bg-tn-primary text-[#ffffff] rounded-[12px] px-4 py-3 text-[13px] font-semibold shadow-[0_18px_40px_-14px_rgba(1,35,88,.6)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E9E6A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"><path d="M5 12l5 5 9-10" /></svg>
            <p className="m-0">{toast}</p>
          </div>
        )}

        {/* Chat and Email have no settings yet: the link is the bell's alone. */}
        {kind === 'bell' && (
          <div className="px-5 py-3 border-t border-[var(--panel-border)]">
            <Link href="/settings#notifications" onClick={onClose} className={`${BTN.navy} w-full justify-center`}>Open notification settings</Link>
          </div>
        )}
      </div>
    </>
  )
}

// ── Clocky's rows ───────────────────────────────────────────────────────────

const ICON = {
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  stop: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM9 9h6v6H9z',
  request: 'M12 8v4l2.5 1.5M20 12a8 8 0 1 0-8 8M18 15v6M15 18h6',
  ok: 'M5 12l5 5 9-10',
  no: 'M6 6l12 12M18 6 6 18',
  shield: 'M12 22s8-3 8-9V6l-8-3-8 3v7c0 6 8 9 8 9zM12 8v4M12 16h.01',
} as const
const WARN = { bg: 'var(--warn-bg)', fg: 'var(--warn-fg)' }
const DANGER = { bg: '#fdeeef', fg: '#c8323d' }

/** The symbol and its colours for each Clocky notification (Clock Safety.dc.html). */
export function clockyTone(i: Pick<NotificationItem, 'type' | 'who'>): { d: string; bg: string; fg: string } {
  switch (i.type) {
    case 'clocky-still-working': return { d: ICON.alert, ...WARN }
    case 'clocky-stopped': return { d: ICON.stop, ...DANGER }
    // The allowance's row also says a clock stopped at the limit (owner, 25 October 2026).
    case 'clocky-allowance': return /^Your clock stopped at /.test(i.who) ? { d: ICON.stop, ...DANGER } : { d: ICON.shield, bg: 'var(--color-tn-teal-soft)', fg: 'var(--color-tn-teal)' }
    case 'clocky-correction-requested':
    case 'clocky-timeoff-requested': return { d: ICON.request, ...WARN }
    // One type for both answers: the sentence says which (lib/timeclock/notify-text.ts).
    case 'clocky-clocked-out-for': return { d: ICON.stop, ...WARN }
    case 'clocky-timesheet-submitted': return { d: ICON.request, ...WARN }
    case 'clocky-timesheet-decided': return / approved your /.test(i.who)
      ? { d: ICON.ok, bg: 'var(--ok-bg)', fg: 'var(--ok-fg)' }
      : { d: ICON.alert, ...WARN }
    case 'clocky-timeoff-decided':
    case 'clocky-correction-decided': return / denied your /.test(i.who)
      ? { d: ICON.no, ...DANGER }
      : { d: ICON.ok, bg: 'var(--ok-bg)', fg: 'var(--ok-fg)' }
    default: return { d: ICON.shield, bg: 'var(--color-tn-teal-soft)', fg: 'var(--color-tn-teal)' }
  }
}

function ClockyRow({ item, unread, done, busy, onButton }: {
  item: NotificationItem
  unread: boolean
  done?: string
  busy: boolean
  onButton: () => void
}) {
  const tone = clockyTone(item)
  return (
    <div className={`flex gap-[11px] px-2.5 py-3 rounded-[11px] leading-[normal] ${unread ? 'bg-[#f8f7f3]' : 'bg-white'}`}>
      <span className="w-[34px] h-[34px] rounded-[10px] shrink-0 inline-flex items-center justify-center" style={{ background: tone.bg, color: tone.fg }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={tone.d} /></svg>
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex justify-between gap-2">
          <span className="font-(family-name:--font-display) font-extrabold text-[12px] text-tn-teal">{item.src}</span>
          <span className="text-[11.5px] text-muted tabular-nums lining-nums whitespace-nowrap">{item.when}</span>
        </div>
        <p className={`m-0 text-[13px] text-tn-ink leading-[1.45] ${unread ? 'font-semibold' : 'font-normal'}`}>
          {unread && <span className="sr-only">Unread. </span>}{item.who}
        </p>
        {done ? (
          <p className="m-0 text-[12px] font-bold text-[var(--ok-fg)]">{done}</p>
        ) : item.button && (
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onButton}
              disabled={busy}
              className="inline-flex items-center gap-[7px] rounded-[9px] px-[13px] py-2 bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[12.5px] transition-colors hover:bg-[#0a2f6b] disabled:opacity-60"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#F2C40A" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" /></svg>
              {item.button.label}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
