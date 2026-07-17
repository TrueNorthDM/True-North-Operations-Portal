'use client'

// The profile card's avatar with a camera button that opens the crop editor,
// plus a remove option. Uploads the cropped square via the scoped avatar action.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/Avatar'
import { AvatarEditor } from '@/components/AvatarEditor'
import { uploadMyAvatar, removeMyAvatar } from '@/app/(app)/profile/avatar-actions'

export function ProfileAvatar({ name, avatarUrl, color }: { name: string; avatarUrl: string | null; color: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function onSave(blob: Blob) {
    setBusy(true); setErr(null)
    try {
      const fd = new FormData()
      fd.set('file', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
      await uploadMyAvatar(fd)
      setOpen(false)
      startTransition(() => router.refresh())
    } catch (e) { setErr(e instanceof Error ? e.message : 'Upload failed') }
    finally { setBusy(false) }
  }

  async function remove() {
    setBusy(true); setErr(null)
    try { await removeMyAvatar(); startTransition(() => router.refresh()) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not remove') }
    finally { setBusy(false) }
  }

  return (
    <div className="shrink-0">
      <div className="relative w-[60px] h-[60px]">
        <Avatar name={name} avatarUrl={avatarUrl} size={60} color={color} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Change photo"
          className="absolute -bottom-1 -right-1 inline-flex w-7 h-7 items-center justify-center rounded-full bg-tn-primary border-2 border-white shadow-sm hover:brightness-110 transition"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
        </button>
      </div>
      {avatarUrl && (
        <button type="button" onClick={remove} disabled={busy} className="block mt-1.5 text-[11px] font-semibold text-muted hover:text-red-600 transition-colors disabled:opacity-50">Remove</button>
      )}
      {err && <p className="text-[11px] text-red-600 mt-1 max-w-[90px]">{err}</p>}
      <AvatarEditor open={open} onClose={() => setOpen(false)} onSave={onSave} busy={busy} />
    </div>
  )
}
