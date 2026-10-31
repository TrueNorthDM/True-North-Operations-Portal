'use client'

/**
 * The Agenda (Clocky part 2, Agenda.dc.html): 8A month, 8B week, 8C list, the
 * "Coming up" panel, 8D the item card and 8E a new event or milestone. An
 * event the viewer may manage (the same people who may create it) has Edit,
 * which opens 8E filled, and Delete, confirmed inside the card.
 *
 * The server sends the items of the days on screen (lib/agenda/data.ts), with
 * what the viewer may not see already left out. Moving to other days changes
 * the address, and the server sends those; the chips and the team filter only
 * hide what is here.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { withViewAs } from '@/components/ViewAsKeeper'
import { Select } from '@/components/ui/Select'
import { useModal } from '@/components/ui/useModal'
import { BTN_ICON } from '@/lib/ui/buttons'
import { MeetIcon } from '@/components/ui/MeetIcon'
import { DetailFoot, DetailTop } from './EventDetail'
import { ScopeChoice } from './ScopeChoice'
import type { Scope } from '@/lib/agenda/recurrence'
import { BTN_MODAL_WHITE, FieldLabel, ICON, Icon, Toast, useIsClient, type ToastState } from '@/components/clocky/entries/ui'
import {
  ALL_TEAMS, AG_ICON, KIND, KINDS, cardOf, comingUp, dayKinds, fday, filterItems, listDays, monthCells, rangeTitle, stepAnchor, viewDays, weekModel, weekNumber,
  type AgendaItem, type AgendaKind, type AgendaView as View, type ListDay,
} from '@/lib/agenda/model'
import { usePhone } from '@/components/clocky/clock/hooks'
import { addDays } from '@/lib/timeclock/periods'
import { TenureBadge } from '@/components/TenureBadge'
import { yearColor } from '@/lib/tenure'
import type { EventEdit } from '@/lib/agenda/events'
import { NewEventDialog, type NewEventSetup, type CreateEvent, type DeleteEvent, type UpdateEvent } from './NewEventDialog'
import { EventDrawer, type DrawerApi } from './EventDrawer'
import type { DrawerSetup } from '@/lib/agenda/drawer-data'
import type { Answer, DrawerEdit } from '@/lib/agenda/model'

export interface AgendaData {
  view: View
  anchor: string
  today: string
  items: AgendaItem[]
  teams: { id: string; name: string; color: string }[]
  me: { id: string; superAdmin: boolean; zone: string }
  /** Company holidays near these days, for "Back on". */
  holidays: string[]
  /** Who may create, and with what (null: nobody here may). */
  create: NewEventSetup | null
  /** The new Agenda (migration 134 open): the New event drawer replaces the dialog. */
  drawer?: DrawerSetup | null
  /** Design checks: a card or the new event dialog already open. */
  startCard?: string
  startNew?: boolean
  /** Design checks: the open card already asking to confirm Delete, or its Edit form open. */
  startConfirm?: boolean
  startEdit?: boolean
}

/** Edit and delete an event (the page passes its server actions; the design checks, stand-ins). */
export interface EventEditApi { update: UpdateEvent; remove: DeleteEvent }

const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const LABEL = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted'
/** The week number (owner, 2026-10-23): not in the handoff. */
const WEEK_TAG = 'rounded-[6px] px-2 py-[3px] bg-tn-teal-soft text-tn-teal font-(family-name:--font-display) font-extrabold text-[11.5px] leading-[normal] whitespace-nowrap tabular-nums lining-nums'
/** A work anniversary's HR badge (TenureBadge), compact in the small chips. */
const Anni = ({ yrs, size, compact = false }: { yrs: number; size: number; compact?: boolean }) =>
  <TenureBadge milestone={{ kind: 'year', value: yrs, color: yearColor(yrs) }} size={size} compact={compact} />
const SEG_BTN = 'border-0 cursor-pointer rounded-[8px] px-3.5 py-[7px] font-(family-name:--font-display) font-bold text-[12.5px] leading-[normal]'

export function AgendaView({ data, api, edit, drawerApi, linked = true }: { data: AgendaData; api: CreateEvent; edit?: EventEditApi; drawerApi?: DrawerApi; linked?: boolean }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [view, setView] = useState<View>(data.view)
  const [anchor, setAnchor] = useState(data.anchor)
  const [on, setOn] = useState<ReadonlySet<AgendaKind>>(() => new Set(KINDS))
  const [team, setTeam] = useState(ALL_TEAMS)
  const [card, setCard] = useState<string | null>(data.startCard ?? null)
  const [creating, setCreating] = useState(!!data.startNew)
  const [editing, setEditing] = useState<EventEdit | null>(() => (data.startEdit && data.items.find(x => x.id === data.startCard)?.edit) || null)
  const [drawerEdit, setDrawerEdit] = useState<DrawerEdit | null>(null)
  const drawer = drawerApi && data.drawer ? data.drawer : null
  const [toast, setToast] = useState<ToastState | null>(null)
  // A phone: the month in dots, and the day picked listed under it (no phone design in the handoff).
  const phone = usePhone()
  const [pick, setPick] = useState<string | null>(null)

  const go = (v: View, a: string) => {
    setView(v); setAnchor(a)
    if (linked) startTransition(() => router.replace(withViewAs(`/agenda?view=${v}&d=${a}`), { scroll: false }))
  }

  const items = useMemo(() => filterItems(data.items, on, team), [data.items, on, team])
  const seesType = (x: AgendaItem) => !!x.type
  const holidays = useMemo(() => new Set(data.holidays), [data.holidays])
  const open = data.items.find(x => x.id === card) ?? null
  const say = (t: ToastState) => { setToast(t); setTimeout(() => setToast(null), 4200) }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex items-end justify-between gap-3.5 flex-wrap">
        <div>
          <Breadcrumb self="/agenda" />
          <h1 className="m-0 font-(family-name:--font-display) font-extrabold text-[30px] leading-[normal] text-tn-ink" style={{ letterSpacing: '-.01em' }}>Agenda</h1>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5" role="group" aria-label="View">
            {(['month', 'week', 'list'] as const).map(k => (
              <button key={k} type="button" aria-pressed={view === k} onClick={() => go(k, anchor)}
                className={`${SEG_BTN} ${view === k ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-foreground'}`}>{k[0].toUpperCase() + k.slice(1)}</button>
            ))}
          </div>
          <button type="button" onClick={() => go(view, data.today)} className="border border-slate-200 rounded-[10px] px-[13px] py-2 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[12.5px] leading-[normal] cursor-pointer hover:border-tn-teal">Today</button>
          <div className="flex items-center gap-0.5">
            <button type="button" aria-label="Previous" onClick={() => go(view, stepAnchor(view, anchor, -1))} className="w-[34px] h-[34px] border-0 rounded-[9px] bg-transparent cursor-pointer text-tn-ink flex items-center justify-center hover:bg-white"><Icon d="M15 18l-6-6 6-6" size={17} width={2.2} /></button>
            <button type="button" aria-label="Next" onClick={() => go(view, stepAnchor(view, anchor, 1))} className="w-[34px] h-[34px] border-0 rounded-[9px] bg-transparent cursor-pointer text-tn-ink flex items-center justify-center hover:bg-white"><Icon d="M9 6l6 6-6 6" size={17} width={2.2} /></button>
          </div>
          <span className="font-(family-name:--font-display) font-extrabold text-[16px] leading-[normal] text-tn-ink min-w-[150px] whitespace-nowrap">{rangeTitle(view, anchor)}</span>
          {view === 'week' && <span className={WEEK_TAG}>Week {weekNumber(anchor)}</span>}
          {(drawer || data.create) && (
            <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2 border-0 rounded-[10px] px-4 py-2.5 bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] leading-[normal] cursor-pointer shadow-[0_6px_16px_-8px_rgba(1,35,88,.55)] hover:bg-[#0a2f6b]">
              <Icon d="M12 5v14M5 12h14" size={14} color={BTN_ICON.navy} width={3} />{!drawer && data.create?.mode === 'team' ? 'New team event' : 'New event'}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-end gap-2.5 flex-wrap">
        <div className="flex gap-1.5 flex-1 min-w-0 overflow-x-auto md:flex-wrap md:overflow-visible [scrollbar-width:none]">
          {KINDS.map(k => {
            const isOn = on.has(k)
            return (
              <button key={k} type="button" aria-pressed={isOn} onClick={() => setOn(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })}
                className={`flex-none whitespace-nowrap inline-flex items-center gap-[7px] border rounded-full px-3 py-1.5 font-(family-name:--font-display) font-bold text-[12px] leading-[normal] cursor-pointer ${isOn ? 'border-[#cbd2da] bg-white text-tn-ink' : 'border-[var(--panel-border)] bg-transparent text-muted'}`}>
                <span className="w-[9px] h-[9px] rounded-[3px]" style={{ background: KIND[k].swatch, opacity: isOn ? 1 : 0.35 }} />{KIND[k].label}
              </button>
            )
          })}
        </div>
        <div className="w-full md:w-[200px] flex flex-col gap-[5px]">
          <FieldLabel>Team</FieldLabel>
          <Select value={team} onChange={setTeam} searchable fullWidth ariaLabel="Team"
            options={[{ value: ALL_TEAMS, label: 'All teams' }, ...data.teams.map(t => ({ value: t.id, label: t.name }))]}
            className="h-[34px] px-3 bg-white border border-[var(--panel-border)] rounded-[10px] font-(family-name:--font-display) font-semibold text-[13px] hover:border-tn-teal aria-expanded:border-tn-teal aria-expanded:shadow-[0_0_0_3px_rgba(30,125,127,.15)]" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_290px] gap-4 items-start">
        <div className="min-w-0">
          {view === 'month' && (phone
            ? <MonthPhone items={items} anchor={anchor} today={data.today} seesType={seesType} pick={pick} onPick={setPick} onOpen={setCard} />
            : <Month items={items} anchor={anchor} today={data.today} onOpen={setCard} onMore={d => go('list', d)} />)}
          {view === 'week' && (phone
            ? <WeekPhone items={items} anchor={anchor} today={data.today} seesType={seesType} onOpen={setCard} />
            : <Week items={items} anchor={anchor} today={data.today} seesType={seesType} onOpen={setCard} />)}
          {view === 'list' && <List items={items} start={viewDays('list', anchor).from} today={data.today} seesType={seesType} onOpen={setCard} />}
        </div>
        <ComingUp items={items} today={data.today} onOpen={setCard} />
      </div>

      {open && !editing && (
        <ItemCard item={open} me={data.me} today={data.today} holidays={holidays} onClose={() => setCard(null)} startConfirm={!!data.startConfirm}
          manage={drawer && drawerApi && open.drawerEdit ? {
            onEdit: () => { setDrawerEdit(open.drawerEdit!); setCard(null) },
            onDelete: (scope?: Scope) => drawerApi.remove({ id: open.drawerEdit!.id, occurrence: open.drawerEdit!.occurrence && scope ? { day: open.drawerEdit!.occurrence, scope } : null }),
            series: !!open.drawerEdit.occurrence,
            onDeleted: t => { setCard(null); say({ text: t }); if (linked) router.refresh() },
          } : edit && data.create && open.edit ? {
            onEdit: () => setEditing(open.edit!),
            onDelete: () => edit.remove({ id: open.edit!.id }),
            onDeleted: t => { setCard(null); say({ text: t }); if (linked) router.refresh() },
          } : undefined}
          google={drawerApi?.answers && open.detail ? {
            answers: drawerApi.answers, answer: drawerApi.answer,
            onGone: () => { setCard(null); say({ text: 'That event was deleted in Google Calendar, so it is off the Agenda too.' }); if (linked) router.refresh() },
            onAnswered: t => { say({ text: t }); if (linked) router.refresh() },
          } : undefined} />
      )}
      {drawer && drawerApi && (creating || drawerEdit) && (
        <EventDrawer key={drawerEdit?.id ?? 'new'} setup={drawer} editing={drawerEdit} today={data.today} api={drawerApi}
          onClose={() => { setCreating(false); setDrawerEdit(null) }}
          onDone={t => { setCreating(false); setDrawerEdit(null); say({ text: t }); if (linked) router.refresh() }} />
      )}
      {!drawer && creating && data.create && (
        <NewEventDialog setup={data.create} api={api} onClose={() => setCreating(false)}
          onDone={t => { setCreating(false); say({ text: t }); if (linked) router.refresh() }} />
      )}
      {editing && edit && data.create && (
        <NewEventDialog key={editing.id} setup={data.create} editing={editing} api={i => edit.update({ ...i, id: editing.id })} onClose={() => setEditing(null)}
          onDone={t => { setEditing(null); setCard(null); say({ text: t }); if (linked) router.refresh() }} />
      )}
      <Toast toast={toast} />
    </div>
  )
}

// ── 8A ──────────────────────────────────────────────────────────────────────

function Month({ items, anchor, today, onOpen, onMore }: { items: AgendaItem[]; anchor: string; today: string; onOpen: (id: string) => void; onMore: (day: string) => void }) {
  const cells = monthCells(items, anchor, today)
  return (
    <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-hidden">
      <div className="grid grid-cols-[34px_repeat(7,minmax(0,1fr))] bg-subtle border-b border-[var(--panel-border)]">
        <div className={`px-2.5 py-2 leading-[normal] ${LABEL}`}>W</div>
        {DOWS.map(d => <div key={d} className={`px-2.5 py-2 leading-[normal] ${LABEL}`}>{d}</div>)}
      </div>
      <div className="grid grid-cols-[34px_repeat(7,minmax(0,1fr))]">
        {cells.map((d, i) => [
          i % 7 === 0 && <div key={`w${d.day}`} className="box-border border-r border-b border-[var(--row-rule)] pt-[11px] text-center text-[11px] font-bold leading-[normal] text-tn-teal tabular-nums lining-nums">{weekNumber(d.day)}</div>,
          (
          <div key={d.day} className={`min-h-[124px] box-border border-r border-b border-[var(--row-rule)] pt-1.5 px-1.5 pb-2 flex flex-col gap-[3px] min-w-0 ${d.inMonth ? 'bg-white' : 'bg-[#faf9f5]'}`}>
            <div className="flex items-center justify-between gap-1 min-h-6">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold leading-[normal] tabular-nums lining-nums ${d.today ? 'bg-tn-primary text-[#ffffff]' : d.inMonth ? 'text-tn-ink' : 'text-[#cbd2da]'}`}>{d.n}</span>
              {d.out.length > 0 && (
                <button type="button" title={d.outTip} aria-label={d.outTip} onClick={() => onOpen(d.out[0].id)} className="flex items-center border-0 bg-transparent p-0 cursor-pointer">
                  {d.out.map(o => <span key={o.id} className="w-6 h-6 rounded-full -ml-[5px] border-2 border-white text-tn-ink text-[8.5px] font-extrabold leading-[normal] flex items-center justify-center" style={{ background: o.color }}>{o.ini}</span>)}
                </button>
              )}
            </div>
            {d.items.map(it => (
              <button key={it.id} type="button" title={it.title} onClick={() => onOpen(it.id)}
                className="flex items-center gap-[5px] border-0 rounded-[6px] px-1.5 py-[3px] font-sans text-[11.5px] font-semibold leading-[normal] cursor-pointer text-left min-w-0"
                style={{ background: it.look.bg, color: it.look.fg }}>
                {it.look.yrs ? <Anni yrs={it.look.yrs} size={14} compact /> : it.look.flag ? <span className="flex-none text-[11px] leading-none">{it.look.flag}</span> : it.look.d && <Icon d={it.look.d} size={11} width={2.4} className="flex-none" />}
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">{it.label}</span>
                {it.meet && <MeetIcon size={13} className="ml-auto flex-none" />}
              </button>
            ))}
            {d.more > 0 && <button type="button" onClick={() => onMore(d.day)} className="border-0 bg-transparent px-1.5 py-px text-left text-[11.5px] font-bold leading-[normal] text-tn-teal cursor-pointer">+{d.more} more</button>}
          </div>
          ),
        ])}
      </div>
    </div>
  )
}

// ── 8B ──────────────────────────────────────────────────────────────────────

function Week({ items, anchor, today, seesType, onOpen }: { items: AgendaItem[]; anchor: string; today: string; seesType: (x: AgendaItem) => boolean; onOpen: (id: string) => void }) {
  const wk = weekModel(items, anchor, today, seesType)
  return (
    <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-hidden">
      <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] bg-subtle border-b border-[var(--panel-border)]">
        <div />
        {wk.heads.map(h => (
          <div key={h.n} className="p-2 flex items-baseline gap-1.5 leading-[normal]">
            <span className={LABEL}>{h.d}</span>
            <span className={`font-(family-name:--font-display) font-black text-[16px] ${h.today ? 'text-[#c8323d]' : 'text-tn-ink'}`}>{h.n}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] auto-rows-[26px] gap-y-1 py-2 border-b border-[var(--panel-border)]">
        <div className="col-start-1 row-start-1 text-[10.5px] text-muted px-2 py-[5px] font-bold leading-[normal]">ALL DAY</div>
        {wk.bars.map(b => (
          <button key={b.id} type="button" title={b.title} onClick={() => onOpen(b.id)}
            className="mx-1 border-0 rounded-[7px] px-[9px] text-[12px] font-bold leading-[normal] flex items-center gap-1.5 cursor-pointer min-w-0 text-left"
            style={{ gridColumn: b.col, gridRow: b.row, background: b.look.bg, color: b.look.fg }}>
            {b.look.yrs ? <Anni yrs={b.look.yrs} size={16} compact /> : b.look.flag ? <span className="flex-none text-[12px] leading-none">{b.look.flag}</span> : b.look.d && <Icon d={b.look.d} size={12} width={2.4} className="flex-none" />}
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{b.label}</span>
          </button>
        ))}
      </div>
      <div className="relative grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
        <div className="flex flex-col">
          {wk.hours.map(h => <div key={h} className="h-12 box-border px-2 py-0.5 text-[10.5px] text-muted leading-[normal] tabular-nums lining-nums border-t border-[#f1f3f6]">{h}</div>)}
        </div>
        {wk.cols.map((c, i) => (
          <div key={i} className={`relative border-l border-[var(--row-rule)] ${c.weekend ? 'bg-[#faf9f5]' : 'bg-white'}`}>
            {wk.hours.map(h => <div key={h} className="h-12 box-border border-t border-[#f1f3f6]" />)}
            {c.events.map(e => (
              <button key={e.id} type="button" title={`${e.title}, ${e.time}`} onClick={() => onOpen(e.id)}
                className={`absolute border-0 border-l-2 border-white rounded-[8px] px-[7px] text-left cursor-pointer flex overflow-hidden whitespace-nowrap ${e.short ? 'flex-row items-center gap-1.5 py-0' : 'flex-col gap-0.5 py-[5px]'} ${e.meet ? 'pr-6' : ''}`}
                style={{ top: e.top, height: e.height, left: `calc(${(e.lane / e.lanes) * 100}% + 2px)`, width: `calc(${100 / e.lanes}% - 4px)`, background: e.look.bg, color: e.look.fg }}>
                <span className="min-w-0 shrink text-[11.5px] font-bold leading-[1.25] overflow-hidden text-ellipsis">{e.title}</span>
                <span className={`flex-none text-[10.5px] leading-[normal] opacity-85 ${e.short ? '' : 'overflow-hidden text-ellipsis'}`}>{e.short ? e.start : e.time}</span>
                {e.meet && <MeetIcon size={e.short ? 14 : 16} className={`absolute right-[5px] ${e.short ? 'top-1/2 -translate-y-1/2' : 'bottom-[5px]'}`} />}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 8C ──────────────────────────────────────────────────────────────────────

function List({ items, start, today, seesType, onOpen }: { items: AgendaItem[]; start: string; today: string; seesType: (x: AgendaItem) => boolean; onOpen: (id: string) => void }) {
  const days = listDays(items, start, today, seesType)
  if (!days.length) return <p className="m-0 bg-white border border-[var(--panel-border)] rounded-[14px] px-5 py-4 text-[13px] text-muted">Nothing on these two weeks.</p>
  return (
    <div className="flex flex-col gap-3">
      {days.map(g => (
        <div key={g.day} className="grid grid-cols-1 md:grid-cols-[120px_minmax(0,1fr)] gap-1.5 md:gap-3.5 items-start">
          {/* On a phone the day sits above its rows, so the names have the width. */}
          <div className="flex md:flex-col items-baseline md:items-stretch gap-2 md:gap-0 md:pt-2.5 leading-[normal]">
            <span className={`font-(family-name:--font-display) font-black text-[16px] ${g.today ? 'text-[#c8323d]' : 'text-tn-ink'}`}>{g.title}</span>
            <span className="text-[12px] text-muted">{g.sub}</span>
          </div>
          <Rows rows={g.rows} onOpen={onOpen} />
        </div>
      ))}
    </div>
  )
}

function Rows({ rows, onOpen }: { rows: ListDay['rows']; onOpen: (id: string) => void }) {
  return (
    <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-hidden">
      {rows.map(it => (
        <button key={it.id} type="button" onClick={() => onOpen(it.id)} className="w-full flex items-center gap-3 border-0 border-b border-[var(--row-rule)] bg-white px-3.5 py-[11px] cursor-pointer text-left leading-[normal] whitespace-nowrap hover:bg-[#f8f7f3]">
          {it.yrs ? <Anni yrs={it.yrs} size={30} compact /> : <span className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center flex-none" style={{ background: it.bg, color: it.fg }}>{it.flag ? <span className="text-[16px] leading-none">{it.flag}</span> : <Icon d={it.d} size={15} width={2.2} />}</span>}
          <span className="flex-1 min-w-0 flex flex-col gap-0.5">
            <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink overflow-hidden text-ellipsis">{it.label}</span>
            <span className="text-[12px] text-muted overflow-hidden text-ellipsis">{it.sub}</span>
          </span>
          {it.meet && <MeetIcon size={20} className="flex-none" />}
          <span className="text-[12px] text-foreground whitespace-nowrap tabular-nums lining-nums">{it.time}</span>
        </button>
      ))}
    </div>
  )
}

// ── 8A on a phone ───────────────────────────────────────────────────────────

/** The month with a dot per kind on each day; the day tapped (today at first) is listed under it. */
function MonthPhone({ items, anchor, today, seesType, pick, onPick, onOpen }: {
  items: AgendaItem[]; anchor: string; today: string; seesType: (x: AgendaItem) => boolean
  pick: string | null; onPick: (day: string) => void; onOpen: (id: string) => void
}) {
  const month = anchor.slice(0, 7)
  const cells = monthCells(items, anchor, today)
  const sel = pick?.startsWith(month) ? pick : today.startsWith(month) ? today : `${month}-01`
  const first = listDays(items, sel, today, seesType)[0]
  const rows = first?.day === sel ? first.rows : []
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-hidden">
        <div className="grid grid-cols-7 bg-subtle border-b border-[var(--panel-border)]">
          {DOWS.map(d => <div key={d} className={`py-2 text-center leading-[normal] ${LABEL}`}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map(d => {
            const on = d.day === sel
            return (
              <button key={d.day} type="button" disabled={!d.inMonth} aria-pressed={on} aria-label={fday(d.day)} onClick={() => onPick(d.day)}
                className={`h-[54px] border-0 border-r border-b border-[var(--row-rule)] flex flex-col items-center pt-1.5 gap-1 cursor-pointer disabled:cursor-default ${on ? 'bg-tn-teal-soft' : d.inMonth ? 'bg-white' : 'bg-[#faf9f5]'}`}>
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold leading-[normal] tabular-nums lining-nums ${d.today ? 'bg-tn-primary text-[#ffffff]' : d.inMonth ? 'text-tn-ink' : 'text-[#cbd2da]'}`}>{d.n}</span>
                {d.inMonth && (
                  <span className="flex items-center gap-[3px]">
                    {dayKinds(items, d.day).map(k => {
                      // An anniversary keeps its HR badge here too, the year of the first one that day.
                      const yrs = k === 'anni' ? items.find(x => x.k === 'anni' && x.a === d.day)?.yrs : undefined
                      return yrs ? <Anni key={k} yrs={yrs} size={12} compact /> : <span key={k} className="w-[5px] h-[5px] rounded-full self-center" style={{ background: KIND[k].swatch }} />
                    })}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex items-baseline gap-2 leading-[normal]">
        <span className={`font-(family-name:--font-display) font-black text-[16px] ${sel === today ? 'text-[#c8323d]' : 'text-tn-ink'}`}>{fday(sel)}</span>
        {sel === today && <span className="text-[12px] text-muted">Today</span>}
      </div>
      {rows.length ? <Rows rows={rows} onOpen={onOpen} /> : <p className="m-0 bg-white border border-[var(--panel-border)] rounded-[14px] px-4 py-3.5 text-[13px] text-muted">Nothing on this day.</p>}
    </div>
  )
}

// ── 8B on a phone ───────────────────────────────────────────────────────────

/** The week's seven days one under the other, each with its items as the List shows them (owner, 2026-10-23). */
function WeekPhone({ items, anchor, today, seesType, onOpen }: { items: AgendaItem[]; anchor: string; today: string; seesType: (x: AgendaItem) => boolean; onOpen: (id: string) => void }) {
  const { from } = viewDays('week', anchor)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(from, i)
    const first = listDays(items, d, today, seesType)[0]
    return { day: d, rows: first?.day === d ? first.rows : [] }
  })
  return (
    <div className="flex flex-col gap-3">
      {days.map(g => (
        <div key={g.day} className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2 leading-[normal]">
            <span className={`font-(family-name:--font-display) font-black text-[15px] ${g.day === today ? 'text-[#c8323d]' : 'text-tn-ink'}`}>{fday(g.day)}</span>
            {g.day === today && <span className="text-[12px] text-muted">Today</span>}
          </div>
          {g.rows.length ? <Rows rows={g.rows} onOpen={onOpen} /> : <span className="text-[12.5px] text-muted">Nothing on this day.</span>}
        </div>
      ))}
    </div>
  )
}

// ── Coming up ───────────────────────────────────────────────────────────────

function ComingUp({ items, today, onOpen }: { items: AgendaItem[]; today: string; onOpen: (id: string) => void }) {
  const groups = comingUp(items, today)
  return (
    <div className="bg-white border border-[var(--panel-border)] rounded-[14px] p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between leading-[normal]">
        <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Coming up</span>
        <span className="text-[11.5px] text-muted">Next 14 days</span>
      </div>
      {groups.map(g => (
        <div key={g.title} className="flex flex-col gap-1.5">
          <span className={`leading-[normal] ${LABEL}`}>{g.title}</span>
          {g.items.map(it => (
            <button key={it.id} type="button" onClick={() => onOpen(it.id)} className="flex items-center gap-[9px] border-0 bg-transparent py-[3px] px-0 cursor-pointer text-left leading-[normal]">
              {it.yrs ? <Anni yrs={it.yrs} size={20} compact />
                : it.d ? <span className="w-5 h-5 rounded-[6px] flex items-center justify-center flex-none" style={{ background: it.bg, color: it.fg }}><Icon d={it.d} size={11} width={2.4} /></span>
                : <span className="w-5 h-5 flex items-center justify-center flex-none"><span className="w-2 h-2 rounded-full" style={{ background: it.c }} /></span>}
              <span className="flex-1 min-w-0 text-[12.5px] text-tn-ink font-semibold overflow-hidden text-ellipsis whitespace-nowrap">{it.label}</span>
              <span className="text-[11.5px] text-muted whitespace-nowrap">{it.when}</span>
            </button>
          ))}
        </div>
      ))}
      {!groups.length && <span className="text-[12.5px] text-muted">Nothing in the next two weeks.</span>}
    </div>
  )
}

// ── 8D ──────────────────────────────────────────────────────────────────────

type Done = { ok: true; toast: string } | { ok: false; error: string }
/** The card's Edit and Delete, for an event the viewer may manage. */
interface Manage { onEdit: () => void; onDelete: (scope?: Scope) => Promise<Done>; onDeleted: (toast: string) => void; /** One occurrence of a series: Delete asks which ones. */ series?: boolean }
/** A drawer event's Google side: the guests' answers, a guest's own answer, and the event deleted in Google. */
interface CardGoogle {
  answers: NonNullable<DrawerApi['answers']>; answer?: DrawerApi['answer']
  onGone: () => void; onAnswered: (toast: string) => void
}

/** The small white row actions (the "Open in Google Calendar" link's look): green symbol, navy words. */
const ROW_BTN = 'inline-flex items-center gap-2 border border-slate-200 rounded-[10px] px-3.5 py-[9px] bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[12.5px] leading-[normal] no-underline cursor-pointer hover:border-tn-teal'

function ItemCard({ item, me, today, holidays, onClose, manage, google, startConfirm = false }: {
  item: AgendaItem; me: AgendaData['me']; today: string; holidays: ReadonlySet<string>; onClose: () => void
  manage?: Manage; google?: CardGoogle; startConfirm?: boolean
}) {
  const box = useRef<HTMLDivElement>(null)
  useModal(true, box, onClose)
  const client = useIsClient()
  const [confirm, setConfirm] = useState(startConfirm && !!manage)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, Answer> | null>(null)
  const [myAnswer, setMyAnswer] = useState<Answer | null>(item.detail?.myAnswer ?? null)
  const [answering, setAnswering] = useState(false)
  const [scoping, setScoping] = useState(false)
  const eventId = item.detail?.onGoogle ? item.detail.eventId : null
  // Opening the card reads the guests' answers from Google, and finds an event deleted there.
  useEffect(() => {
    if (eventId == null || !google) return
    let live = true
    google.answers({ id: eventId }).then(r => {
      if (!live || !r.ok) return
      if (r.gone) google.onGone()
      else setAnswers(r.answers)
    }).catch(() => { /* the stored answers stand */ })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])
  if (!client) return null
  const c = cardOf(item, { meId: me.id, superAdmin: me.superAdmin, today, zone: me.zone, holidays })
  const what = item.k === 'ms' ? 'milestone' : 'event'
  const remove = async (scope?: Scope) => {
    if (!manage || busy) return
    setBusy(true); setError(null)
    try {
      const r = await manage.onDelete(scope)
      if (r.ok) manage.onDeleted(r.toast)
      else setError(r.error)
    } catch {
      setError('That did not go through. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }
  return createPortal(
    <div className="fixed inset-0 z-[70] bg-[rgba(1,35,88,.24)] flex items-center justify-center p-7" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={c.title} className="w-full max-w-[440px] bg-white rounded-[16px] shadow-[0_30px_70px_-20px_rgba(1,35,88,.5)] overflow-hidden flex flex-col leading-[normal]">
        <div className="h-1.5" style={{ background: c.band }} />
        <div className="pt-[18px] px-5 pb-5 flex flex-col gap-3.5">
          <div className="flex items-start gap-3">
            {c.yrs ? <Anni yrs={c.yrs} size={44} /> : (
              <span className={`w-10 h-10 flex items-center justify-center flex-none font-(family-name:--font-display) font-extrabold text-[13px] ${c.round ? 'rounded-full' : 'rounded-[12px]'}`} style={{ background: c.icBg, color: c.icFg }}>
                {c.ini ?? (c.flag ? <span className="text-[20px] leading-none">{c.flag}</span> : <Icon d={c.d} size={18} width={2} />)}
              </span>
            )}
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase" style={{ color: c.kindFg }}>{c.kind}</span>
              <span className="font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink leading-[1.3]">{c.title}</span>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="w-[30px] h-[30px] border-0 bg-transparent rounded-[8px] cursor-pointer text-muted flex items-center justify-center hover:bg-subtle"><Icon d="M6 6l12 12M18 6 6 18" size={17} width={2.2} /></button>
          </div>
          <div className="flex flex-col gap-[9px]">
            {c.rows.map((r, i) => (
              <div key={i} className="flex gap-2.5 items-start text-[13px] text-foreground leading-[1.5]">
                <Icon d={r.d} size={15} color="#8593a4" width={2} className="flex-none mt-0.5" />
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="[text-wrap:pretty]">{r.b && <b className={`text-tn-ink ${r.bold ? 'font-bold' : 'font-normal'}`}>{r.b}</b>}{r.t}</span>
                  {r.sub && <span className="text-[12.5px] text-muted [text-wrap:pretty]">{r.sub}</span>}
                </span>
              </div>
            ))}
          </div>
          {c.detail && <DetailTop detail={c.detail} meet={c.meet} answers={answers} />}
          {c.meet && !c.detail && (
            <a href={c.meet} target="_blank" rel="noopener noreferrer"
              className="group flex items-center gap-[13px] rounded-[14px] border border-[var(--panel-border)] bg-[#f8f9fb] px-4 py-3.5 no-underline hover:border-tn-teal">
              <MeetIcon size={34} className="flex-none" />
              <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-[.08em] text-muted">Join with Google Meet</span>
                <span className="truncate text-[14px] font-semibold text-tn-ink group-hover:underline">{c.meet.replace(/^https?:\/\//, '')}</span>
              </span>
              <Icon d="M7 17L17 7M7 7h10v10" size={15} color="#8593a4" width={2} className="flex-none" />
            </a>
          )}
          {c.desc && <div className="text-[13px] text-foreground leading-[1.55] bg-subtle rounded-[10px] px-3 py-2.5 [text-wrap:pretty]">{c.desc}</div>}
          {c.foot && <div className="text-[12px] text-muted leading-[1.5]">{c.foot}</div>}
          {c.detail && (
            <DetailFoot detail={c.detail} by={item.by ?? null} myAnswer={myAnswer} busy={answering}
              onAnswer={google?.answer ? async a => {
                const before = myAnswer
                setMyAnswer(a); setAnswering(true)
                try {
                  const r = await google.answer!({ id: c.detail!.eventId, answer: a })
                  if (r.ok) google.onAnswered(r.toast)
                  else { setMyAnswer(before); setError(r.error) }
                } catch {
                  setMyAnswer(before); setError('That did not go through. Check your connection and try again.')
                } finally {
                  setAnswering(false)
                }
              } : undefined} />
          )}
          {error && !confirm && <p role="alert" className="m-0 text-[12.5px] font-semibold text-[#c8323d]">{error}</p>}
          {confirm && manage ? (
            <div role="alertdialog" aria-label={`Delete this ${what}?`} className="flex flex-col gap-2.5 border border-[#f3c9cd] bg-[#fdf5f6] rounded-[12px] px-3.5 py-3">
              <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">Delete this {what}?</span>
              <span className="text-[13px] text-foreground leading-[1.5] [text-wrap:pretty]">
                It comes off the Agenda for everyone{item.edit?.google ? ', and off the team Google Calendar' : item.evType && item.onGoogle ? ', and off Google Calendar, which tells the guests' : ''}. This cannot be undone.
              </span>
              {error && <p role="alert" className="m-0 text-[12.5px] font-semibold text-[#c8323d]">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" disabled={busy} onClick={() => { setConfirm(false); setError(null) }} className={`${BTN_MODAL_WHITE} cursor-pointer`}>Keep it</button>
                <button type="button" disabled={busy} onClick={() => void remove()}
                  className="inline-flex items-center rounded-[10px] px-[18px] py-[11px] border-0 bg-[#c8323d] text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] leading-[normal] cursor-pointer hover:bg-[#b02a34] disabled:opacity-45 disabled:cursor-not-allowed">
                  {busy ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          ) : (c.button || manage) && (
            <div className="flex justify-end gap-2 flex-wrap">
              {manage && <>
                <button type="button" onClick={() => (manage.series ? setScoping(true) : setConfirm(true))} className={ROW_BTN}>
                  <Icon d={ICON.trash} size={14} color={BTN_ICON.white} width={2.2} />Delete
                </button>
                <button type="button" onClick={manage.onEdit} className={ROW_BTN}>
                  <Icon d={AG_ICON.edit} size={14} color={BTN_ICON.white} width={2.2} />Edit
                </button>
              </>}
              {c.button && (
                <a href={c.button.href} target="_blank" rel="noopener noreferrer" className={ROW_BTN}>
                  <Icon d={AG_ICON.ext} size={14} color="#1E9E6A" width={2.2} />{c.button.label}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
      {scoping && manage && <ScopeChoice action="delete" busy={busy} onClose={() => setScoping(false)} onPick={sc => void remove(sc)} />}
    </div>,
    document.body,
  )
}
