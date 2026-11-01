'use client'

/**
 * Company settings > Integrations, "Google Drive" (owner, 30 October 2026):
 * a Super Admin picks with Google's Picker the folder where the portal writes
 * receipts and invoices (Tina's folder, shared with office@), and can write a
 * test file into it. The Picker runs here with office@'s short-lived token.
 *
 * Under the folder (owner, 31 October 2026): what is copied, the folders the
 * portal makes, and how the copies are doing, with Try again on each one that
 * failed, "Copy the missing now" and "Open the folder in Drive". The actions
 * are Super Admins' (lib/drive/copies.ts does the copying).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GoogleIcon } from '@/components/ui/GoogleIcon'
import { BTN } from '@/lib/ui/buttons'
import { FIELD_LABEL, CARD } from '@/lib/ui/type'
import { PILL } from '@/components/ui/Pill'
import { ERROR_TEXT } from '@/lib/ui/feedback'
import type { DriveStatus } from '@/lib/drive/copies'

type Done = { ok: true; toast: string } | { ok: false; error: string }
export interface DriveApi {
  drivePicker(): Promise<{ ok: true; token: string; key: string; appId: string } | { ok: false; error: string }>
  saveDriveFolder(i: { id: string; name: string }): Promise<Done>
  testDrive(): Promise<Done>
  retryDriveCopy?(i: { id: number }): Promise<Done>
  copyDriveNow?(): Promise<Done>
}

/** What is copied, and when (the approved design's three lines). */
const WHAT = [
  { k: 'Invoices', v: 'When approved; a new version of the same file when paid' },
  { k: 'Reimbursement receipts', v: 'When the reimbursement is approved' },
  { k: 'Reimbursement documents (RMB)', v: 'When made; a new version when paid' },
]

/* The few parts of Google's Picker the card uses. */
interface PickerAnswer { action: string; docs?: { id: string; name: string }[] }
type Obj = Record<string, (...a: unknown[]) => unknown>
interface PickerNS { Action: { PICKED: string }; ViewId: { FOLDERS: string }; Feature: { SUPPORT_DRIVES: string }; DocsView: new (id: string) => Obj; PickerBuilder: new () => Obj }
type Win = Window & { gapi?: { load(name: string, cb: () => void): void }; google?: { picker: PickerNS } }

let loading: Promise<void> | null = null
function loadPicker(): Promise<void> {
  const w = window as Win
  if (w.google?.picker) return Promise.resolve()
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://apis.google.com/js/api.js'
    s.async = true
    s.onload = () => (window as Win).gapi?.load('picker', () => resolve())
    s.onerror = () => { loading = null; reject(new Error('Google\'s Picker did not load. Check the connection and try again.')) }
    document.head.appendChild(s)
  })
  return loading
}

const ROW_BTN = `${BTN.smallWhite} disabled:opacity-50 disabled:cursor-default`

export function DriveCard({ data, canEdit, api, say }: {
  data: { ready: boolean; why: string | null; folder: string | null; who: string; rootIsDocs?: boolean; copies?: DriveStatus | null }
  canEdit: boolean; api?: DriveApi; say: (t: { text: string; error?: boolean }) => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const pick = async () => {
    if (!api) return
    setBusy(true)
    try {
      const p = await api.drivePicker()
      if (!p.ok) { say({ text: p.error, error: true }); return }
      await loadPicker()
      const g = (window as Win).google!.picker
      // office@'s own folders, and a tab for folders someone shared with it:
      // Tina may keep "Docs from the Portal" in her Drive and share it with
      // office@ as an editor (owner, 31 October 2026).
      const folders = (shared: boolean) => {
        const v = new g.DocsView(g.ViewId.FOLDERS)
        v.setSelectFolderEnabled(true); v.setIncludeFolders(true); v.setMimeTypes('application/vnd.google-apps.folder')
        if (shared) { v.setOwnedByMe(false); v.setLabel('Shared with me') }
        return v
      }
      const b = new g.PickerBuilder()
      b.addView(folders(false)); b.addView(folders(true)); b.enableFeature(g.Feature.SUPPORT_DRIVES)
      b.setOAuthToken(p.token); b.setDeveloperKey(p.key); b.setAppId(p.appId)
      b.setTitle('Pick the folder for receipts and invoices')
      b.setCallback(async (r: unknown) => {
        const a = r as PickerAnswer
        if (a.action !== g.Action.PICKED || !a.docs?.[0]) return
        const res = await api.saveDriveFolder({ id: a.docs[0].id, name: a.docs[0].name })
        say(res.ok ? { text: res.toast } : { text: res.error, error: true })
        if (res.ok) location.reload()
      })
      ;(b.build() as Obj).setVisible(true)
    } catch (e) {
      say({ text: e instanceof Error ? e.message : 'The Picker did not open. Try again.', error: true })
    } finally {
      setBusy(false)
    }
  }
  const test = async () => {
    if (!api) return
    setBusy(true)
    try {
      const r = await api.testDrive()
      say(r.ok ? { text: r.toast } : { text: r.error, error: true })
    } finally {
      setBusy(false)
    }
  }
  const run = async (p: () => Promise<Done>) => {
    setBusy(true)
    try {
      const r = await p()
      say(r.ok ? { text: r.toast } : { text: r.error, error: true })
      router.refresh()
    } catch {
      say({ text: 'That did not go through. Try again in a moment.', error: true })
    } finally {
      setBusy(false)
    }
  }
  const on = data.ready && !!data.folder
  const copies = data.copies
  const root = data.rootIsDocs ? data.folder ?? 'Docs from the Portal' : 'Docs from the Portal'
  return (
    <div className={`${CARD} px-[22px] py-5 flex flex-col gap-4`}>
      <div className="flex items-center gap-3.5 flex-wrap">
        <span className="w-11 h-11 rounded-[12px] flex items-center justify-center flex-none bg-[#eaf4f4]"><GoogleIcon size={22} /></span>
        <div className="flex-1 min-w-[200px] flex flex-col gap-[3px]">
          <div className="flex items-center gap-2.5">
            <span className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink leading-[normal]">Google Drive</span>
            <span className={`${PILL} ${on ? 'bg-[var(--bdg-green-bg)] text-[var(--bdg-green-fg)]' : 'bg-[var(--chip-neutral-bg)] text-[#5b6b82]'}`}>{on ? 'Folder picked' : 'Not set up'}</span>
          </div>
          <span className="text-[12.5px] text-muted">{data.ready ? data.who : data.why}</span>
        </div>
        {canEdit && api && data.ready && (
          <div className="flex gap-2 flex-wrap">
            {data.folder && <button type="button" disabled={busy} onClick={() => void test()} className={ROW_BTN}>Write a test file</button>}
            <button type="button" disabled={busy} onClick={() => void pick()} className={ROW_BTN}>{data.folder ? 'Change folder' : 'Pick the folder'}</button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <div className="bg-subtle rounded-[12px] px-[13px] py-[11px] flex flex-col gap-1">
          <span className={FIELD_LABEL}>Folder</span>
          <span className="text-[13px] text-tn-ink font-semibold leading-[1.45]">{data.folder ?? 'Not picked yet'}</span>
        </div>
        <div className="bg-subtle rounded-[12px] px-[13px] py-[11px] flex flex-col gap-1">
          <span className={FIELD_LABEL}>The portal sees</span>
          <span className="text-[13px] text-tn-ink font-semibold leading-[1.45]">Only this folder and the files it writes there</span>
        </div>
      </div>
      {data.folder && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div className="border border-[var(--panel-border)] rounded-[12px] px-3.5 py-3 flex flex-col gap-2">
              <span className={FIELD_LABEL}>What is copied</span>
              {WHAT.map(w => (
                <div key={w.k} className="flex flex-col gap-0.5 text-[13px]">
                  <span className="text-tn-ink font-bold">{w.k}</span>
                  <span className="text-foreground leading-[1.45]">{w.v}</span>
                </div>
              ))}
              <span className="text-[12px] text-muted leading-[1.5]">From {copies?.from ?? 'Nov 1, 2026'} on; older ones stay in the portal only. Files are named by their number and the person: INV-2026-010-Ana Lima.pdf.</span>
            </div>
            <div className="border border-[var(--panel-border)] rounded-[12px] px-3.5 py-3 flex flex-col gap-2">
              <span className={FIELD_LABEL}>The folders</span>
              <div className="text-[13px] text-tn-ink leading-[1.7] tabular-nums">
                <div className="font-bold">{root}</div>
                <div className="pl-4">Invoices</div>
                <div className="pl-4">Reimbursement Requests</div>
                <div className="pl-8">Receipts</div>
                <div className="pl-8">RMB</div>
              </div>
              <span className="text-[12px] text-muted leading-[1.5]">Made by the portal when they are missing. No folder per person.</span>
            </div>
          </div>
          <div className="border border-[var(--panel-border)] rounded-[12px] px-3.5 py-3 flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`${FIELD_LABEL} flex-1`}>How the copies are doing</span>
              {copies?.folderLink && <a href={copies.folderLink} target="_blank" rel="noreferrer" className={ROW_BTN}>Open the folder in Drive</a>}
              {canEdit && api?.copyDriveNow && on && <button type="button" disabled={busy} onClick={() => void run(api.copyDriveNow!)} className={ROW_BTN}>Copy the missing now</button>}
            </div>
            {copies ? (
              <>
                <div className="grid grid-cols-3 gap-2.5">
                  {[{ k: 'In Drive', v: copies.counts.done, fg: 'text-[var(--bdg-green-fg)]' }, { k: 'Waiting', v: copies.counts.waiting, fg: 'text-[var(--bdg-orange-fg)]' }, { k: 'Failed', v: copies.counts.failed, fg: copies.counts.failed ? ERROR_TEXT : 'text-tn-ink' }].map(x => (
                    <div key={x.k} className="bg-subtle rounded-[12px] px-[13px] py-[11px] flex flex-col gap-1">
                      <span className={FIELD_LABEL}>{x.k}</span>
                      <span className={`font-(family-name:--font-display) font-extrabold text-[20px] tabular-nums lining-nums leading-[normal] ${x.fg}`}>{x.v}</span>
                    </div>
                  ))}
                </div>
                {copies.failed.length > 0 && (
                  <div className="flex flex-col">
                    {copies.failed.map(f => (
                      <div key={f.id} className="flex items-start gap-3 py-2 border-t border-[var(--row-rule)] text-[12.5px]">
                        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <span className="text-tn-ink font-bold">{f.what}</span>
                          <span className={`${ERROR_TEXT} leading-[1.45] [overflow-wrap:anywhere]`}>{f.error}</span>
                          <span className="text-muted tabular-nums lining-nums">{f.when}</span>
                        </span>
                        {canEdit && api?.retryDriveCopy && <button type="button" disabled={busy} onClick={() => void run(() => api.retryDriveCopy!({ id: f.id }))} className={ROW_BTN}>Try again</button>}
                      </div>
                    ))}
                  </div>
                )}
                {!on && <span className="text-[12px] text-muted leading-[1.5]">Nothing is copied until Drive is ready: {data.why ?? 'pick the folder first'}</span>}
              </>
            ) : <span className={`text-[12.5px] ${ERROR_TEXT}`}>The copies could not be read. Reload the page in a moment.</span>}
          </div>
        </>
      )}
    </div>
  )
}
