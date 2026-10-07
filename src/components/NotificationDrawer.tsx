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
 */

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NavIcon } from '@/components/NavIcon'
import type { NavIconKey } from '@/lib/nav/nav-icons'
import { BTN } from '@/lib/ui/buttons'
import { markNotificationsRead, markTabRead } from '@/app/(app)/notifications/actions'

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
}

interface Tab { key: string; label: string; emptyTitle: string; empty: string }

export const DRAWERS: Record<DrawerKind, { title: string; icon: NavIconKey; tabs: [Tab, Tab] }> = {
  bell: {
    title: 'Notifications',
    icon: 'bell',
    tabs: [
      { key: 'tools', label: 'Tools', emptyTitle: 'Nothing from your tools', empty: 'Alerts from the dashboards and reports you can reach land here.' },
      { key: 'system', label: 'System', emptyTitle: 'Nothing from the portal', empty: 'Syncs, tickets and access changes land here.' },
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

export function NotificationDrawer({ kind, tab, onTab, items, read, onRead, onClose }: {
  kind: DrawerKind
  tab: string
  onTab: (key: string) => void
  items: Record<string, NotificationItem[]>
  /** Read since the page loaded, kept by the button so its count follows. */
  read: ReadonlySet<string>
  onRead: (ids: string[]) => void
  onClose: () => void
}) {
  const router = useRouter()
  const d = DRAWERS[kind]
  const [onlyUnread, setOnlyUnread] = useState(false)
  const isUnread = (i: NotificationItem) => i.unread && !read.has(i.id)
  const rows = (items[tab] ?? []).filter(i => !onlyUnread || isUnread(i))
  const current = d.tabs.find(t => t.key === tab) ?? d.tabs[0]
  const pill = (on: boolean) => `rounded-full px-[11px] py-1 text-[12px] font-semibold transition-colors ${on ? 'bg-subtle text-tn-ink' : 'text-muted hover:text-tn-ink'}`

  return (
    <>
      <div aria-hidden="true" onClick={onClose} className="fixed inset-x-0 bottom-0 top-[65px] z-40 bg-[rgba(1,35,88,.16)]" />
      <div role="dialog" aria-label={d.title} className="fixed right-0 bottom-0 top-[65px] z-40 w-[416px] max-w-full bg-white border-l border-[var(--panel-border)] shadow-[-14px_0_40px_rgba(1,35,88,.14)] flex flex-col">
        <div className="px-5 pt-[18px] pb-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-[9px] bg-[rgba(30,125,127,.1)] text-tn-teal inline-flex items-center justify-center"><NavIcon name={d.icon} size={17} /></span>
            <h2 className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink m-0">{d.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg text-muted hover:bg-subtle text-[19px] leading-none">×</button>
        </div>

        <div role="tablist" className="flex gap-0.5 px-4 border-b border-[var(--panel-border)]">
          {d.tabs.map(t => {
            const on = t.key === current.key
            const count = (items[t.key] ?? []).filter(isUnread).length
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => onTab(t.key)}
                className={`flex items-center gap-[7px] px-3 py-2.5 -mb-px border-b-2 text-[13.5px] font-bold whitespace-nowrap transition-colors ${on ? 'text-tn-ink border-tn-primary' : 'text-muted border-transparent hover:text-tn-ink'}`}
              >
                {t.label}
                <span className={`min-w-[18px] h-[18px] rounded-full px-[5px] inline-flex items-center justify-center text-[10.5px] font-bold ${on ? 'bg-tn-primary text-[#ffffff]' : 'bg-[var(--chip-neutral-bg)] text-muted'}`}>{count}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between px-5 py-2.5 border-b border-[var(--row-rule)]">
          <div className="flex gap-1">
            <button type="button" onClick={() => setOnlyUnread(false)} aria-pressed={!onlyUnread} className={pill(!onlyUnread)}>All</button>
            <button type="button" onClick={() => setOnlyUnread(true)} aria-pressed={onlyUnread} className={pill(onlyUnread)}>Unread</button>
          </div>
          <button
            type="button"
            onClick={() => {
              const ids = (items[current.key] ?? []).filter(isUnread).map(i => i.id)
              if (!ids.length) return
              onRead(ids)
              void markTabRead(current.key)
            }}
            className="text-[12.5px] font-semibold text-tn-teal hover:text-tn-ink"
          >
            Mark all read
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <div className="px-8 py-14 text-center flex flex-col items-center gap-2">
              <span className="w-11 h-11 rounded-xl bg-subtle text-muted inline-flex items-center justify-center"><NavIcon name={d.icon} size={20} /></span>
              <p className="text-[14px] font-semibold text-tn-ink m-0">{current.emptyTitle}</p>
              <p className="text-[12.5px] text-muted leading-relaxed m-0 max-w-[280px]">{current.empty}</p>
            </div>
          ) : rows.map(i => {
            const unread = isUnread(i)
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => {
                  if (unread) { onRead([i.id]); void markNotificationsRead([i.id]) }
                  onClose()
                  router.push(i.href)
                }}
                className={`w-full flex gap-3 px-5 py-3.5 border-b border-[var(--row-rule)] text-left transition-colors hover:bg-subtle ${unread ? 'bg-[#f8fbfb]' : 'bg-white'}`}
              >
                <span className={`w-[34px] h-[34px] rounded-[10px] shrink-0 inline-flex items-center justify-center ${unread ? 'bg-[rgba(30,125,127,.12)] text-tn-teal' : 'bg-subtle text-muted'}`}><NavIcon name={i.icon} size={17} /></span>
                <span className="flex-1 min-w-0 flex flex-col gap-[3px]">
                  <span className="flex justify-between items-baseline gap-2">
                    <span className="flex items-baseline gap-1.5 min-w-0">
                      {unread && <span className="w-[7px] h-[7px] rounded-full bg-tn-teal shrink-0 -translate-y-px" />}
                      {/* Wraps rather than truncates: a notification's title is its message. */}
                      <span className="text-[13.5px] font-bold text-tn-ink leading-snug">{i.who}</span>
                    </span>
                    <span className="text-[11.5px] text-muted whitespace-nowrap">{i.when}</span>
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

        <div className="px-5 py-3 border-t border-[var(--panel-border)]">
          <Link href="/settings#notifications" onClick={onClose} className={`${BTN.navy} w-full justify-center`}>Open notification settings</Link>
        </div>
      </div>
    </>
  )
}
