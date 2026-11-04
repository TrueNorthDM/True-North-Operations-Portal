// The System manual's frame (owner, 4 November 2026; mockup "System Manual
// Guides"): the title, the two tabs (Guides, Behind the portal), the tab's
// drawer on the left (groups with a rule between them, pages A to Z, a guide's
// steps under it) and Previous and Next under the page. On a phone the drawer
// folds into "All guides" above the page.

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { TAB_LIST, tabClass } from '@/lib/ui/tabs'
import { PAGE_TITLE } from '@/lib/ui/type'
import { TAB_LABEL, drawerFor, pageHref, readingOrder, type ManualPage, type ManualTab, type ManualViewer } from '@/lib/manual/registry'

const GROUP = 'font-(family-name:--font-display) font-extrabold text-[10.5px] uppercase tracking-[.09em] text-muted px-3 pb-1.5'

function Drawer({ tab, page, viewer }: { tab: ManualTab; page: ManualPage; viewer: ManualViewer }) {
  return (
    <nav aria-label={TAB_LABEL[tab]} className="flex flex-col gap-0.5">
      {drawerFor(tab, viewer).map((g, i) => (
        <div key={g.group} className="flex flex-col gap-0.5">
          {i > 0 && <div className="my-2.5 mx-3 border-t border-[var(--panel-border)]" role="separator" />}
          <div className={GROUP}>{g.group}</div>
          {g.pages.map(p => {
            const inside = p.slug === page.slug || p.children.some(c => c.slug === page.slug)
            return (
              <div key={p.slug} className="flex flex-col gap-0.5">
                <Item page={p} on={p.slug === page.slug} />
                {inside && p.children.map(c => <Item key={c.slug} page={c} on={c.slug === page.slug} sub />)}
              </div>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function Item({ page, on, sub = false }: { page: ManualPage; on: boolean; sub?: boolean }) {
  return (
    <Link href={pageHref(page)} aria-current={on ? 'page' : undefined}
      className={`${sub ? 'text-[13px] pl-6' : 'text-[13.5px] pl-3'} pr-3 py-[7px] rounded-lg border-l-2 transition-colors ${on ? 'border-tn-teal bg-tn-teal-soft text-tn-teal font-bold' : 'border-transparent text-muted font-semibold hover:text-tn-ink hover:bg-subtle'}`}>
      {page.title}
    </Link>
  )
}

function NextPrev({ tab, page, viewer }: { tab: ManualTab; page: ManualPage; viewer: ManualViewer }) {
  const order = readingOrder(tab, viewer)
  const i = order.findIndex(p => p.slug === page.slug)
  const prev = i > 0 ? order[i - 1] : null
  const next = i >= 0 && i < order.length - 1 ? order[i + 1] : null
  if (!prev && !next) return null
  const CARD = 'flex-[1_1_220px] flex flex-col gap-0.5 rounded-[12px] border border-[var(--panel-border)] bg-white px-4 py-3 hover:border-tn-teal transition-colors'
  return (
    <div className="flex flex-wrap gap-3 border-t border-[var(--panel-border)] pt-5 mt-4">
      {prev ? <Link href={pageHref(prev)} className={CARD}><span className="text-[12px] text-muted">Previous</span><span className="font-(family-name:--font-display) font-extrabold text-[14.5px] text-tn-ink">{prev.title}</span></Link> : <span className="flex-[1_1_220px]" />}
      {next && <Link href={pageHref(next)} className={`${CARD} items-end text-right`}><span className="text-[12px] text-muted">Next</span><span className="font-(family-name:--font-display) font-extrabold text-[14.5px] text-tn-ink">{next.title}</span></Link>}
    </div>
  )
}

export function ManualShell({ tab, page, viewer, children }: { tab: ManualTab; page: ManualPage; viewer: ManualViewer; children: ReactNode }) {
  const tabs: ManualTab[] = ['guides', 'behind']
  const first = (t: ManualTab) => readingOrder(t, viewer)[0]
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Breadcrumb self="/manual" />
        <h1 className={PAGE_TITLE}>System manual</h1>
        <p className="mt-1.5 text-muted">Step-by-step guides to every part of the portal, and how it works behind the scenes.</p>
      </div>
      <nav aria-label="System manual" className={TAB_LIST}>
        {tabs.map(t => (
          <Link key={t} href={pageHref(first(t))} aria-current={t === tab ? 'page' : undefined} className={tabClass(t === tab)}>{TAB_LABEL[t]}</Link>
        ))}
      </nav>
      <details className="lg:hidden rounded-[12px] border border-[var(--panel-border)] bg-white">
        <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-3 min-h-[48px]">
          <span className="flex flex-col"><span className="text-[11px] text-muted">{page.group}</span><span className="font-(family-name:--font-display) font-extrabold text-[14.5px] text-tn-ink">{page.title}</span></span>
          <span className="text-[13px] font-bold text-tn-teal">All {tab === 'guides' ? 'guides' : 'pages'}</span>
        </summary>
        <div className="px-1 pb-3"><Drawer tab={tab} page={page} viewer={viewer} /></div>
      </details>
      <div className="grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)] gap-10 items-start">
        <div className="hidden lg:block lg:sticky lg:top-[81px] lg:max-h-[calc(100vh-97px)] lg:overflow-y-auto"><Drawer tab={tab} page={page} viewer={viewer} /></div>
        <article className="min-w-0 flex flex-col gap-6">
          {children}
          <NextPrev tab={tab} page={page} viewer={viewer} />
        </article>
      </div>
    </div>
  )
}
