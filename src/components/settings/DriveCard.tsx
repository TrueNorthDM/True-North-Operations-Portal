'use client'

/**
 * Company settings > Integrations, "Google Drive" (owner, 30 October 2026):
 * a Super Admin picks with Google's Picker the folder where the portal writes
 * receipts and invoices (Tina's folder, shared with office@), and can write a
 * test file into it. The Picker runs here with office@'s short-lived token.
 */

import { useState } from 'react'
import { GoogleIcon } from '@/components/ui/GoogleIcon'

type Done = { ok: true; toast: string } | { ok: false; error: string }
export interface DriveApi {
  drivePicker(): Promise<{ ok: true; token: string; key: string; appId: string } | { ok: false; error: string }>
  saveDriveFolder(i: { id: string; name: string }): Promise<Done>
  testDrive(): Promise<Done>
}

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

const BTN = 'inline-flex items-center gap-2 border border-[var(--panel-border)] rounded-[10px] px-3.5 py-2 bg-white font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-ink cursor-pointer hover:border-tn-teal disabled:opacity-50 disabled:cursor-default'

export function DriveCard({ data, canEdit, api, say }: {
  data: { ready: boolean; why: string | null; folder: string | null; who: string }
  canEdit: boolean; api?: DriveApi; say: (t: { text: string; error?: boolean }) => void
}) {
  const [busy, setBusy] = useState(false)
  const pick = async () => {
    if (!api) return
    setBusy(true)
    try {
      const p = await api.drivePicker()
      if (!p.ok) { say({ text: p.error, error: true }); return }
      await loadPicker()
      const g = (window as Win).google!.picker
      const view = new g.DocsView(g.ViewId.FOLDERS)
      view.setSelectFolderEnabled(true); view.setIncludeFolders(true); view.setMimeTypes('application/vnd.google-apps.folder')
      const b = new g.PickerBuilder()
      b.addView(view); b.enableFeature(g.Feature.SUPPORT_DRIVES)
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
  const on = data.ready && !!data.folder
  return (
    <div className="bg-white border border-[var(--panel-border)] rounded-[16px] px-[22px] py-5 flex flex-col gap-4">
      <div className="flex items-center gap-3.5 flex-wrap">
        <span className="w-11 h-11 rounded-[12px] flex items-center justify-center flex-none bg-[#eaf4f4]"><GoogleIcon size={22} /></span>
        <div className="flex-1 min-w-[200px] flex flex-col gap-[3px]">
          <div className="flex items-center gap-2.5">
            <span className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink leading-[normal]">Google Drive</span>
            <span className={`font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.05em] uppercase rounded-full px-[9px] py-1 ${on ? 'bg-[#e6f6ee] text-[#0d7a4f]' : 'bg-[var(--chip-neutral-bg)] text-[#5b6b82]'}`}>{on ? 'Folder picked' : 'Not set up'}</span>
          </div>
          <span className="text-[12.5px] text-muted">{data.ready ? data.who : data.why}</span>
        </div>
        {canEdit && api && data.ready && (
          <div className="flex gap-2 flex-wrap">
            {data.folder && <button type="button" disabled={busy} onClick={() => void test()} className={BTN}>Write a test file</button>}
            <button type="button" disabled={busy} onClick={() => void pick()} className={BTN}>{data.folder ? 'Change folder' : 'Pick the folder'}</button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <div className="bg-subtle rounded-[12px] px-[13px] py-[11px] flex flex-col gap-1">
          <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-muted">Folder</span>
          <span className="text-[13px] text-tn-ink font-semibold leading-[1.45]">{data.folder ?? 'Not picked yet'}</span>
        </div>
        <div className="bg-subtle rounded-[12px] px-[13px] py-[11px] flex flex-col gap-1">
          <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-muted">The portal sees</span>
          <span className="text-[13px] text-tn-ink font-semibold leading-[1.45]">Only this folder and the files it writes there</span>
        </div>
      </div>
    </div>
  )
}
