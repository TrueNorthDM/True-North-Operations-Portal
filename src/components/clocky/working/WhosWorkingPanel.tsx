'use client'

/**
 * Who's working (design handoff of 16 October 2026, SPEC section 7, Who's
 * Working.dc.html, 2A to 2P): the drawer from the top bar's people icon (480px
 * from the right, under the top bar) and the same list as a page inside
 * Clocky. Each person's local time and zone, the running timer, the day and
 * week, grouped by team; the warn colour past 4h 30m, "Auto out", and for a
 * Super Admin the row menu with "Clock out for them..." (2E).
 */

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/Avatar'
import { Segmented } from '@/components/ui/Segmented'
import { withViewAs } from '@/components/ViewAsKeeper'
import type { WhosWorkingData, WorkingPerson } from '@/lib/timeclock/clocky-types'
import { ClockField, ClockToast, FOCUS, HeadButton, ICON, Icon, SearchInput, StopIcon } from '../clock/ClockParts'
import { ClockOutForDialog } from './ClockOutForDialog'
import type { WorkingApi } from './working-api'
import { SORTS, emptyTitle, groupsOf, scopeText, viewerTime, type WorkingFilter, type WorkingRow, type WorkingSort } from './working-model'

export const WHOS_WORKING_HREF = '/clocky-hours/whos-working'
/** A person's entries on Time entries. */
export const theirEntriesHref = (personId: string) => `/clocky-hours?person=${encodeURIComponent(personId)}`

export interface WorkingUi {
  filter: WorkingFilter
  sort: WorkingSort
  query: string
  /** The row whose menu is open, and whose 2E window. */
  menu: string | null
  dialog: string | null
}

export const WORKING_UI: WorkingUi = { filter: 'on', sort: 'Day total', query: '', menu: null, dialog: null }

export function WhosWorkingPanel({
  data, loadError, api, variant, meName, nowMs, frameTop, initialUi, teamOrder, onClose, onData, closeRef, fill = false,
}: {
  data: WhosWorkingData | null
  loadError: string | null
  api: WorkingApi
  variant: 'drawer' | 'page'
  meName: string
  nowMs: number
  /** Design check: drawn inside a frame, this far down, instead of fixed to the window. */
  frameTop?: number | string
  initialUi?: Partial<WorkingUi>
  /** The order of the team groups when known (a design check gives the prototype's); else by name. */
  teamOrder?: readonly string[]
  onClose?: () => void
  /** The list read again (Refresh, after a clock out). */
  onData: (d: WhosWorkingData) => void
  closeRef?: React.RefObject<HTMLElement | null>
  /** The page card fills its parent (a design check's frame) instead of the window. */
  fill?: boolean
}) {
  const router = useRouter()
  const [ui, setUi] = useState<WorkingUi>({ ...WORKING_UI, ...initialUi })
  const [closed, setClosed] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A successful Refresh here answers the parent's failed first read too.
  const [readSince, setReadSince] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const set = (patch: Partial<WorkingUi>) => setUi(u => ({ ...u, ...patch }))
  const page = variant === 'page'
  const contained = frameTop != null
  const box = useRef<HTMLDivElement>(null)

  const say = (t: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(t)
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  // The drawer: focus in when it opens, back to the icon when it closes, Escape closes it.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })
  useEffect(() => {
    if (page) return
    box.current?.focus({ preventScroll: true })
    const back = closeRef?.current
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('[role="listbox"], [role="alertdialog"], [aria-modal="true"], [data-working-menu]')) return
      onCloseRef.current?.()
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); back?.focus({ preventScroll: true }) }
  }, [page, closeRef])

  // The row menu closes on a click elsewhere and on Escape.
  useEffect(() => {
    if (!ui.menu) return
    const onDown = (e: MouseEvent) => { if (!(e.target as Element).closest?.('[data-working-menu], [data-working-menu-button]')) setUi(u => ({ ...u, menu: null })) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setUi(u => ({ ...u, menu: null })) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [ui.menu])

  const reload = async (): Promise<boolean> => {
    try {
      const r = await api.load()
      if (r.ok) { onData(r.data); setError(null); setReadSince(true); return true }
      setError(r.error)
    } catch {
      setError("Who's working could not be read. Try again in a moment.")
    }
    return false
  }

  const clockOut = async (p: WorkingPerson, end: string, reason: string) => {
    setBusy(true)
    let res: { ok: true; toast: string } | { ok: false; error: string }
    try { res = await api.clockOutFor({ personId: p.personId, end, reason }) } catch { res = { ok: false, error: 'Not saved. Try again in a moment.' } }
    setBusy(false)
    if (!res.ok) { setError(res.error); set({ dialog: null }); return }
    set({ dialog: null })
    say(res.toast)
    await reload()
  }

  const groups = data ? groupsOf(data, { nowMs, filter: ui.filter, sort: ui.sort, query: ui.query, teamOrder }) : []
  const dialogPerson = data && ui.dialog ? data.people.find(p => p.personId === ui.dialog) ?? null : null

  const place = page
    ? `relative bg-white border border-[var(--panel-border)] rounded-[16px] ${fill ? 'h-full' : 'h-[calc(100dvh-var(--chrome-top)-92px)] min-h-[480px]'}`
    : `${contained ? 'absolute' : 'fixed'} right-0 bottom-0 ${contained ? '' : 'top-[var(--chrome-top)]'} w-[481px] max-w-full bg-white border-l border-[var(--panel-border)] shadow-[-24px_0_50px_-24px_rgba(1,35,88,.35)] z-[35]`

  return (
    <>
      <div ref={box} role={page ? 'region' : 'dialog'} aria-label="Who's working" tabIndex={page ? undefined : -1} style={contained && !page ? { top: frameTop } : undefined}
        className={`${place} flex flex-col outline-none leading-[normal]`}>
        <div className="shrink-0 pt-4 pr-3.5 pl-[18px] flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <h2 style={{ letterSpacing: 'normal' }} className={`m-0 font-(family-name:--font-display) font-extrabold text-tn-ink ${page ? 'text-[30px]' : 'text-[17px]'}`}>Who&apos;s working</h2>
              <div className="text-[12.5px] text-muted mt-1 tabular-nums lining-nums">{data ? viewerTime(nowMs, data.viewer.zone) : ''}</div>
            </div>
            <HeadButton label="Refresh" title="Refresh" size={32} onClick={() => void reload().then(ok => { if (ok) say('Updated just now.') })}>
              <Icon d={ICON.refresh} size={17} sw={2} />
            </HeadButton>
            {!page && (
              <>
                <HeadButton label="Open as a page" title="Open as a page" size={32} onClick={() => { onClose?.(); router.push(withViewAs(WHOS_WORKING_HREF)) }}>
                  <Icon d={ICON.openPage} size={16} sw={2} />
                </HeadButton>
                <HeadButton label="Close" size={32} onClick={() => onClose?.()}>
                  <Icon d={ICON.close} size={17} sw={2.2} join={null} />
                </HeadButton>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Segmented label="Show" display="px-[11px] py-1.5 text-[12.5px]" value={ui.filter} onChange={k => set({ filter: k })}
              options={[{ key: 'on', label: 'On the clock' }, { key: 'all', label: 'Everyone today' }]} />
            <div className="w-[150px]">
              <ClockField value={ui.sort} options={[...SORTS]} onChange={v => set({ sort: v as WorkingSort })} compact ariaLabel="Sort" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <SearchInput value={ui.query} onChange={q => set({ query: q })} placeholder="Search people" height={36} iconTop={10} iconLeft={11} iconSize={15} padLeft={33} fontSize={13} />
            </div>
          </div>
          {data?.viewer.scope === 'team' && (
            <div className="text-[12px] text-[var(--chip-neutral-fg)] bg-[var(--chip-neutral-bg)] rounded-[9px] px-2.5 py-[7px]">{scopeText(data.viewer.teamNames)}</div>
          )}
          <div className="h-px bg-[var(--row-rule)] -mr-3.5 -ml-[18px]" />
        </div>

        <div className="flex-1 min-h-0 overflow-auto pt-1.5 px-2.5 pb-4">
          {(error || (loadError && !readSince)) && (
            <div role="alert" className="mx-2 mt-2 rounded-[11px] bg-[#fdeeef] border border-[#f3c6ca] px-3 py-2.5 text-[12.5px] text-[#c8323d] font-bold leading-[1.4]">{error ?? loadError}</div>
          )}
          {groups.map(g => {
            const open = !closed.includes(g.key)
            return (
              <div key={g.key} className="flex flex-col">
                <button type="button" aria-expanded={open} onClick={() => setClosed(c => (open ? [...c, g.key] : c.filter(k => k !== g.key)))}
                  className={`flex items-center gap-[9px] border-0 bg-transparent cursor-pointer pt-3 px-2 pb-2 text-left ${FOCUS}`}>
                  <Icon d={ICON.chevronDown} size={14} stroke="#8593a4" sw={2.4} className="transition-transform duration-150" style={{ transform: `rotate(${open ? 0 : -90}deg)` }} />
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: g.color }} />
                  <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">{g.name}</span>
                  <span className="text-[12px] text-muted">· {g.count}</span>
                </button>
                {open && g.rows.map(r => (
                  <PersonRow key={r.person.personId} row={r} menuOpen={ui.menu === r.person.personId}
                    onMenu={() => set({ menu: ui.menu === r.person.personId ? null : r.person.personId })}
                    onClockOut={() => set({ menu: null, dialog: r.person.personId })} />
                ))}
              </div>
            )
          })}
          {data && groups.length === 0 && (
            <div className="flex flex-col items-center gap-2.5 py-14 px-5 text-center">
              <Icon d={ICON.clock} size={34} stroke="#cbd2da" sw={1.8} />
              <div className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{emptyTitle(ui.filter, ui.query)}</div>
              {ui.filter === 'on' && !ui.query.trim() && (
                <button type="button" onClick={() => set({ filter: 'all' })} className={`inline-flex items-center border border-slate-200 rounded-[10px] px-[15px] py-[9px] bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] transition-colors hover:border-tn-teal ${FOCUS}`}>See everyone today</button>
              )}
            </div>
          )}
        </div>
      </div>

      {dialogPerson && data && (
        <ClockOutForDialog person={dialogPerson} meName={meName} viewerZone={data.viewer.zone} nowMs={nowMs} busy={busy} contained={contained}
          onClose={() => set({ dialog: null })} onConfirm={(end, reason) => void clockOut(dialogPerson, end, reason)} />
      )}
      {toast && <ClockToast text={toast} contained={contained} />}
    </>
  )
}

function PersonRow({ row: r, menuOpen, onMenu, onClockOut }: { row: WorkingRow; menuOpen: boolean; onMenu: () => void; onClockOut: () => void }) {
  const p = r.person
  return (
    <div className={`relative grid grid-cols-[38px_minmax(0,1fr)_auto] gap-3 items-center py-2.5 px-2 rounded-[11px] hover:bg-[var(--row-hover)] ${r.warn ? 'bg-[#fdf8e7]' : ''}`}>
      <div className="relative w-9 h-9">
        <Avatar name={p.name} avatarUrl={p.avatarUrl} size={36} color="#012358" />
        <span title={r.status} className="absolute -right-px -bottom-px w-4 h-4 rounded-full border-2 border-white" style={{ background: r.dot }} />
      </div>
      <div className="min-w-0 flex flex-col gap-[3px]">
        <div className="flex items-center gap-[7px] flex-wrap">
          <span className="font-(family-name:--font-display) font-bold text-[13.5px] text-tn-ink">{p.name}</span>
          {r.tags.map(t => (
            <span key={t.text} title={t.tip} className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.05em] uppercase rounded-full px-2 py-[2px] tabular-nums lining-nums"
              style={{ background: t.bg, color: t.fg }}>{t.text}</span>
          ))}
        </div>
        <div className="text-[12px] truncate" style={{ color: r.lineFg }}>{r.line}</div>
        <div className="flex items-center gap-[5px] text-[11.5px] text-muted tabular-nums lining-nums">
          <Icon d={ICON.globe} size={12} sw={2} join={null} />
          <span title={p.zone}>{r.local}</span><span>{`· ${r.status}`}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex flex-col items-end gap-[3px] tabular-nums lining-nums">
          <div className="flex items-center gap-1.5">
            {r.warn && <span title="On the clock over 4h 30m since clock in" className="w-4 h-4 rounded-full bg-[#8a6d1a] text-[#ffffff] text-[10.5px] font-black flex items-center justify-center">!</span>}
            <span className="font-(family-name:--font-display) font-extrabold text-[15px]" style={{ color: r.timerFg }}>{r.timer}</span>
          </div>
          <div className="text-[11.5px] text-muted whitespace-nowrap">Day <b className="text-foreground">{r.day}</b> · Week <b className="text-foreground">{r.week}</b></div>
        </div>
        {p.canClockOut ? (
          <button type="button" data-working-menu-button onClick={onMenu} aria-label={`More for ${p.name}`} aria-expanded={menuOpen} aria-haspopup="menu"
            className={`w-[30px] h-[30px] border-0 bg-transparent rounded-[8px] cursor-pointer text-muted flex items-center justify-center hover:bg-[var(--chip-neutral-bg)] hover:text-tn-ink ${FOCUS}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
          </button>
        ) : <span className="w-[30px]" />}
      </div>
      {menuOpen && (
        <div data-working-menu role="menu" className="absolute right-2 top-[calc(100%-8px)] z-40 w-[224px] bg-white border border-[var(--panel-border)] rounded-[11px] shadow-[0_18px_40px_-14px_rgba(1,35,88,.32)] p-1.5 flex flex-col gap-0.5">
          <button type="button" role="menuitem" onClick={onClockOut}
            className={`flex items-center gap-[9px] border-0 bg-transparent cursor-pointer text-left rounded-[8px] px-2.5 py-[9px] font-(family-name:--font-display) font-semibold text-[13px] text-[#c8323d] hover:bg-[#fdeeef] ${FOCUS}`}>
            <StopIcon size={13} color="#c8323d" />Clock out for them...
          </button>
          <Link role="menuitem" href={theirEntriesHref(p.personId)}
            className={`flex items-center gap-[9px] rounded-[8px] px-2.5 py-[9px] font-(family-name:--font-display) font-semibold text-[13px] text-tn-ink hover:bg-subtle ${FOCUS}`}>
            <Icon d={ICON.list} size={14} stroke="#1E9E6A" sw={2} join={null} />Their time entries
          </Link>
        </div>
      )}
    </div>
  )
}
