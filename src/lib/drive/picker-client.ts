'use client'

/**
 * Google's Picker, loaded once in the browser (Company settings: the Drive
 * folder for receipts and invoices, the Human Resources folder, and last
 * year's review files). The Picker runs with office@'s short-lived token.
 */

/* The few parts of Google's Picker the portal uses. */
export interface PickerAnswer { action: string; docs?: { id: string; name: string; mimeType?: string; url?: string }[] }
export type PickerObj = Record<string, (...a: unknown[]) => unknown>
export interface PickerNS {
  Action: { PICKED: string }; ViewId: { FOLDERS: string; DOCS: string }; Feature: { SUPPORT_DRIVES: string; MULTISELECT_ENABLED: string }
  DocsView: new (id: string) => PickerObj; PickerBuilder: new () => PickerObj
}
type Win = Window & { gapi?: { load(name: string, cb: () => void): void }; google?: { picker: PickerNS } }

let loading: Promise<void> | null = null
export function loadPicker(): Promise<void> {
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

export const pickerNS = (): PickerNS => (window as Win).google!.picker

/** Opens the Picker: one folder, or many files (PDF and Word). */
export async function openPicker(o: { token: string; key: string; appId: string; title: string; mode: 'folder' | 'files'; onPick: (docs: NonNullable<PickerAnswer['docs']>) => void }): Promise<void> {
  await loadPicker()
  const g = pickerNS()
  // Three tabs: office@'s own Drive, Shared with me, and the Shared drives
  // office@ is a member of (owner, 4 November 2026: the HR files live in one).
  const view = (tab: 'mine' | 'shared' | 'drives') => {
    const v = new g.DocsView(o.mode === 'folder' ? g.ViewId.FOLDERS : g.ViewId.DOCS)
    if (o.mode === 'folder') { v.setSelectFolderEnabled(true); v.setIncludeFolders(true); v.setMimeTypes('application/vnd.google-apps.folder') }
    else { v.setIncludeFolders(true); v.setMimeTypes('application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.google-apps.document') }
    if (tab === 'shared') { v.setOwnedByMe(false); v.setLabel('Shared with me') }
    if (tab === 'drives') { v.setEnableDrives(true); v.setLabel('Shared drives') }
    return v
  }
  const b = new g.PickerBuilder()
  b.addView(view('mine')); b.addView(view('shared')); b.addView(view('drives')); b.enableFeature(g.Feature.SUPPORT_DRIVES)
  if (o.mode === 'files') b.enableFeature(g.Feature.MULTISELECT_ENABLED)
  b.setOAuthToken(o.token); b.setDeveloperKey(o.key); b.setAppId(o.appId)
  b.setTitle(o.title)
  b.setCallback((r: unknown) => {
    const a = r as PickerAnswer
    if (a.action !== g.Action.PICKED || !a.docs?.length) return
    o.onPick(a.docs)
  })
  ;(b.build() as PickerObj).setVisible(true)
}
