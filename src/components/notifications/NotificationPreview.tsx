'use client'

/**
 * The preview window of the notification table: how one notification looks in
 * the bell and in the summary email, and "Send me a test" to either.
 *
 * A dialog as the portal draws them (audit, 9 October 2026): focus moves in
 * when it opens and back to the eye button when it closes, Tab stays inside,
 * Escape and the backdrop close it, and its two tabs are tabs (arrow keys,
 * one tab panel).
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { NavIcon } from '@/components/NavIcon'
import { CATEGORY_LABEL, timingIsChoice, type NotificationType } from '@/lib/notifications/catalogue'
import { barColor } from '@/lib/email/summary'
import { tabKeys } from '@/components/ui/tab-keys'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'

type Result = { ok: boolean; error?: string }
export type SendTest = (key: string, channel: 'app' | 'email') => Promise<Result>

const TABS = ['app', 'email'] as const
const TAB_LABEL = { app: 'In the portal', email: 'By email' } as const

export function NotificationPreview({ t, hour, sendTest, onClose }: { t: NotificationType; hour: number; sendTest: SendTest | null; onClose: () => void }) {
  const router = useRouter()
  const [tab, setTab] = useState<'app' | 'email'>('app')
  const [state, setState] = useState<{ kind: 'idle' | 'sending' | 'sent' | 'error'; text?: string }>({ kind: 'idle' })
  const [, start] = useTransition()
  const box = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })
  const canEmail = timingIsChoice(t) || t.timings === 'daily'

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    box.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current(); return }
      if (e.key !== 'Tab') return
      const list = [...(box.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]') ?? [])]
      if (!list.length) return
      const first = list[0], last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); before?.focus?.() }
  }, [])

  const send = () => {
    if (!sendTest) { setState({ kind: 'sent', text: 'Here in the design check nothing is sent.' }); return }
    setState({ kind: 'sending' })
    start(async () => {
      const res = await sendTest(t.key, tab).catch(() => ({ ok: false, error: 'Not sent. Try again in a moment.' }))
      if (res.ok) {
        setState({ kind: 'sent', text: tab === 'app' ? 'Sent: it is in your bell now, marked Test.' : 'Sent: check your inbox in a minute.' })
        if (tab === 'app') router.refresh()
      } else setState({ kind: 'error', text: res.error ?? 'Not sent.' })
    })
  }
  const pick = (k: 'app' | 'email') => { setTab(k); setState({ kind: 'idle' }) }

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(1,35,88,.35)] flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="notif-preview-title" className="w-full max-w-[560px] bg-white rounded-[18px] shadow-[0_30px_60px_-20px_rgba(1,35,88,.5)] overflow-hidden">
        <div className="px-5 pt-[18px]">
          <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.12em] uppercase text-tn-teal">Preview</span>
          <h3 id="notif-preview-title" className="font-(family-name:--font-display) font-black text-[18px] text-tn-ink m-0 mt-0.5">{t.title}</h3>
        </div>
        <div role="tablist" aria-label="Where it shows" onKeyDown={tabKeys(TABS, tab, pick)} className="flex gap-0.5 px-5 mt-3 border-b border-[var(--panel-border)]">
          {TABS.map(k => (
            <button key={k} type="button" role="tab" id={`notif-preview-tab-${k}`} data-tab={k} aria-selected={tab === k}
              aria-controls="notif-preview-panel" tabIndex={tab === k ? 0 : -1} onClick={() => pick(k)}
              className={`px-3 py-2.5 -mb-px border-b-2 text-[13px] font-bold transition-colors ${tab === k ? 'text-tn-ink border-tn-teal' : 'text-muted border-transparent hover:text-tn-ink'}`}>
              {TAB_LABEL[k]}
            </button>
          ))}
        </div>
        <div id="notif-preview-panel" role="tabpanel" aria-labelledby={`notif-preview-tab-${tab}`} className="bg-subtle px-5 py-[18px] space-y-2.5">
          {tab === 'app' ? (
            <>
              <div className="rounded-[14px] border border-[var(--panel-border)] bg-white overflow-hidden">
                <div className="flex justify-between px-3.5 py-2.5 border-b border-[var(--row-rule)]">
                  <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">Notifications</span>
                  <span className="text-[12px] font-semibold text-tn-teal">Mark all read</span>
                </div>
                <div className="flex gap-3 px-3.5 py-3 bg-[#f8fbfb]">
                  <span className="w-[34px] h-[34px] rounded-[10px] shrink-0 inline-flex items-center justify-center bg-[rgba(30,125,127,.12)] text-tn-teal"><NavIcon name={t.icon} size={17} /></span>
                  <span className="flex-1 min-w-0 flex flex-col gap-[3px]">
                    <span className="flex justify-between items-baseline gap-2">
                      <span className="flex items-baseline gap-1.5 min-w-0">
                        <span className="w-[7px] h-[7px] rounded-full bg-tn-teal shrink-0 -translate-y-px" />
                        <span className="text-[13.5px] font-bold text-tn-ink leading-snug">{t.example.title}</span>
                      </span>
                      <span className="text-[11.5px] text-muted whitespace-nowrap">9:40 AM</span>
                    </span>
                    <span className="text-[12.5px] text-foreground leading-normal">{t.example.body}</span>
                    <span className="text-[10.5px] font-bold tracking-[.06em] uppercase text-muted mt-0.5">{t.src}</span>
                  </span>
                </div>
              </div>
              <p className="text-[12px] text-muted m-0">How it shows in the bell at the top right. Example content.</p>
            </>
          ) : canEmail ? (
            <>
              <div className="rounded-[12px] border border-[var(--row-rule)] bg-white flex items-center gap-3.5 pr-3.5 overflow-hidden">
                <span className="self-stretch w-1 shrink-0" style={{ background: barColor(t.key, t.block === 'system' ? 'system' : 'tools') }} />
                <div className="flex-1 min-w-0 py-3">
                  <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-muted">{t.src}</div>
                  <div className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink leading-snug">{t.example.title}</div>
                  <div className="text-[13px] text-foreground leading-normal">{t.example.body}</div>
                </div>
                <span className="text-[12.5px] font-bold text-tn-teal whitespace-nowrap">Open →</span>
              </div>
              <p className="text-[12px] text-muted m-0">
                {`One line in your ${CATEGORY_LABEL[t.block]} summary email, under "${t.section}". The summary arrives at ${hour}:00 AM, Monday to Friday. Example content.`}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-muted m-0 py-3">This one is never emailed: it always arrives in the bell the moment it happens.</p>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-3.5">
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" onClick={send} disabled={state.kind === 'sending' || (tab === 'email' && !canEmail) || !t.available}
              className={`${BTN.navy} disabled:opacity-40 disabled:hover:translate-y-0`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
              <span className="text-[#ffffff]">{state.kind === 'sending' ? 'Sending…' : tab === 'app' ? 'Send me a test' : 'Email me a test'}</span>
            </button>
            {state.text && <span role="status" className={`text-[12.5px] font-bold ${state.kind === 'error' ? 'text-[#b3271f]' : 'text-[#0d7a4f]'}`}>{state.text}</span>}
          </div>
          <button type="button" onClick={onClose} className={BTN.white}>Close</button>
        </div>
      </div>
    </div>
  )
}
