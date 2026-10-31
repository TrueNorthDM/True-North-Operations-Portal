'use client'

/**
 * The open card of an event from the New event drawer, view mode (owner,
 * 30 October 2026, mockup "Agenda Event Card"): where it is (address with a
 * map link, or the Meet box with Copy), who it is for (guests, teams or all
 * of True North) with each guest's answer read from Google, and the Google
 * lines (sent from, created by, Open in Google Calendar). A guest answers
 * Yes, No or Maybe here; the answer goes to Google.
 */

import { useState } from 'react'
import { Icon } from '@/components/clocky/entries/ui'
import { MeetIcon } from '@/components/ui/MeetIcon'
import { answerCounts, countsLabel, fday, type Answer, type DetailGuest, type EventDetail } from '@/lib/agenda/model'

const HEAD = 'font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink'
const LINK = 'border-0 bg-transparent p-0 cursor-pointer font-bold text-[12.5px] text-tn-teal no-underline hover:underline'
/** How many guests show before "See all". */
const SHOWN = 5

const MARK: Record<Answer, { t: string; label: string; fg: string; bg: string }> = {
  yes: { t: '✓', label: 'Going', fg: '#16695c', bg: '#e2f2ee' },
  no: { t: '✕', label: 'Not going', fg: '#b4232f', bg: '#fbe7e9' },
  maybe: { t: '?', label: 'Maybe', fg: '#8a6703', bg: '#fdf3cf' },
  waiting: { t: '…', label: 'No answer yet', fg: '#6f7c8f', bg: '#eef0f3' },
}

/** The Yes, No and Maybe buttons: each answer in its own colour, filled once chosen. */
const RSVP = {
  yes: { label: 'Yes', d: 'M5 12l5 5L20 7', solid: '#16795a', soft: '#e2f2ee', line: '#b5e0d0', ink: '#16695c' },
  no: { label: 'No', d: 'M6 6l12 12M18 6 6 18', solid: '#c8323d', soft: '#fbe7e9', line: '#f1c3c8', ink: '#b4232f' },
  maybe: { label: 'Maybe', d: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01', solid: '#8a6703', soft: '#fdf3cf', line: '#f0dc93', ink: '#7a5c00' },
} as const

const mapsUrl = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`

/** The place (in person) or the Meet box, then the people. */
export function DetailTop({ detail, meet, answers }: { detail: EventDetail; meet: string | null; answers: Record<string, Answer> | null }) {
  const [all, setAll] = useState(false)
  const [copied, setCopied] = useState(false)
  const guests: DetailGuest[] = detail.guests.map(g => (g.organizer || !answers?.[g.key] ? g : { ...g, answer: answers[g.key] }))
  const invited = guests.filter(g => !g.organizer).length
  const counts = countsLabel(answerCounts(guests))
  const copy = async () => {
    if (!meet) return
    try { await navigator.clipboard.writeText(meet); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* the link stays visible to copy by hand */ }
  }
  const title = detail.audience === 'all' ? `Everyone at True North · ${invited} ${invited === 1 ? 'person' : 'people'}`
    : detail.audience === 'teams' ? `For ${detail.teams.length} team${detail.teams.length === 1 ? '' : 's'} · ${invited} ${invited === 1 ? 'person' : 'people'}`
    : `Guests · ${invited}`
  const list = all || detail.audience === 'guests' ? guests : []
  const shown = all ? list : list.slice(0, SHOWN)
  return (
    <>
      {detail.address && (
        <div className="flex gap-2.5 items-start text-[13px] text-foreground leading-[1.5]">
          <Icon d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" size={15} color="#8593a4" width={2} className="flex-none mt-0.5" />
          <span className="flex flex-col gap-0.5 min-w-0">
            <span className="[text-wrap:pretty]"><b className="text-tn-ink font-semibold">In person</b> · {detail.address}</span>
            <a href={mapsUrl(detail.address)} target="_blank" rel="noopener noreferrer" className={LINK}>Open in Maps ↗</a>
          </span>
        </div>
      )}
      {meet && (
        <div className="flex gap-2 items-stretch">
          <a href={meet} target="_blank" rel="noopener noreferrer"
            className="group flex-1 min-w-0 flex items-center gap-[13px] rounded-[14px] border border-[var(--panel-border)] bg-[#f8f9fb] px-4 py-3.5 no-underline hover:border-tn-teal">
            <MeetIcon size={34} className="flex-none" />
            <span className="min-w-0 flex-1 flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-[.08em] text-muted">Join with Google Meet</span>
              <span className="truncate text-[14px] font-semibold text-tn-ink group-hover:underline">{meet.replace(/^https?:\/\//, '')}</span>
            </span>
            <Icon d="M7 17L17 7M7 7h10v10" size={15} color="#8593a4" width={2} className="flex-none" />
          </a>
          <button type="button" onClick={() => void copy()}
            className="flex-none rounded-[14px] border border-[var(--panel-border)] bg-white px-3.5 flex flex-col items-center justify-center gap-[3px] text-tn-ink text-[11px] font-bold cursor-pointer hover:border-tn-teal">
            <Icon d={copied ? 'M5 12l5 5L20 7' : 'M9 9h11v11H9zM5 15H4V4h11v1'} size={16} color="#1E9E6A" width={2.2} />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-2.5 flex-wrap">
          <span className={HEAD}>{title}</span>
          {detail.onGoogle && counts && <span className="text-[12px] text-foreground">{counts}</span>}
        </div>
        {detail.teams.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {detail.teams.map(t => (
              <span key={t.name} className="inline-flex items-center gap-[7px] border border-[var(--panel-border)] rounded-full py-[5px] pl-2 pr-3 text-[12.5px] font-semibold text-tn-ink">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />{t.name} · {t.count}
              </span>
            ))}
          </div>
        )}
        {shown.length > 0 && (
          <div className="flex flex-col border border-[var(--panel-border)] rounded-[12px] overflow-hidden">
            {shown.map(g => (
              <div key={g.key} className="flex items-center gap-2.5 px-3 py-[9px] border-b border-[#f0f2f5] last:border-b-0">
                <span className="w-[30px] h-[30px] rounded-full flex-none flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[11px] text-tn-ink" style={{ background: g.color }}>{g.ini}</span>
                <span className="flex-1 min-w-0 flex flex-col gap-px">
                  <span className="text-[13px] font-semibold text-tn-ink truncate">{g.name}</span>
                  <span className="text-[11.5px] text-muted truncate">{g.sub}</span>
                </span>
                {detail.onGoogle && (
                  <span title={MARK[g.answer].label} aria-label={MARK[g.answer].label}
                    className="w-[22px] h-[22px] rounded-full flex-none flex items-center justify-center text-[12px] font-bold"
                    style={{ color: MARK[g.answer].fg, background: MARK[g.answer].bg }}>{MARK[g.answer].t}</span>
                )}
              </div>
            ))}
          </div>
        )}
        {!all && invited > 0 && (detail.audience !== 'guests' || guests.length > SHOWN) && (
          <button type="button" onClick={() => setAll(true)} className={`${LINK} self-start`}>
            {detail.audience === 'guests' ? `+ ${guests.length - SHOWN} more` : `See all ${invited}`}
          </button>
        )}
      </div>
    </>
  )
}

/** Sent from, created by, the Google link, and a guest's own answer. */
export function DetailFoot({ detail, by, myAnswer, onAnswer, busy }: {
  detail: EventDetail; by: string | null; myAnswer: Answer | null; onAnswer?: (a: 'yes' | 'no' | 'maybe') => void; busy: boolean
}) {
  const made = [by ? `Created by ${by}` : '', detail.created ? fday(detail.created).replace(/^\w+, /, '') : ''].filter(Boolean).join(', ')
  return (
    <>
      <div className="flex flex-col gap-[5px] text-[12px] text-muted leading-[1.5]">
        {(detail.sentFrom || made) && (
          <span className="[text-wrap:pretty]">
            {detail.sentFrom && <>Sent from <b className="text-foreground font-semibold break-all">{detail.sentFrom}</b></>}
            {detail.sentFrom && made && ' · '}{made}
          </span>
        )}
        {detail.onGoogle && (
          <span>
            {detail.teamCalendar ? 'On the team Google Calendar' : 'Also on Google Calendar'}
            {detail.googleLink && <> · <a href={detail.googleLink} target="_blank" rel="noopener noreferrer" className={LINK}>Open in Google Calendar ↗</a></>}
          </span>
        )}
      </div>
      {myAnswer && onAnswer && (
        <div className="flex flex-col gap-2.5 rounded-[14px] bg-[#f3f2ee] px-3.5 py-3">
          <span className={HEAD}>Going?</span>
          <div className="flex gap-2">
            {(['yes', 'no', 'maybe'] as const).map(a => {
              const on = myAnswer === a, k = RSVP[a]
              const answered = myAnswer !== 'waiting'
              return (
                <button key={a} type="button" aria-pressed={on} disabled={busy} onClick={() => onAnswer(a)}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-[10px] py-2.5 border-2 font-(family-name:--font-display) font-extrabold text-[13.5px] cursor-pointer transition-colors disabled:cursor-default ${answered && !on ? 'opacity-60 hover:opacity-100' : ''}`}
                  style={on ? { background: k.solid, borderColor: k.solid, color: '#ffffff' } : { background: k.soft, borderColor: k.line, color: k.ink }}>
                  <Icon d={k.d} size={15} width={2.6} color={on ? '#ffffff' : k.ink} />
                  {k.label}
                </button>
              )
            })}
          </div>
          {detail.onGoogle && <span className="text-[11.5px] text-muted">Your answer goes to Google, so the organizer sees it there too.</span>}
        </div>
      )}
    </>
  )
}
