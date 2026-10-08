'use client'

// The profile card's avatar with a camera button that opens the crop editor,
// plus a remove option. Uploads the cropped square via the scoped avatar action.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/Avatar'
import { AvatarEditor } from '@/components/AvatarEditor'
import { uploadMyAvatar, removeMyAvatar } from '@/app/(app)/profile/profile-actions'

export function ProfileAvatar({ name, avatarUrl, color, size = 60 }: { name: string; avatarUrl: string | null; color: string; size?: number }) {
  const cam = size >= 100 ? 36 : 28
  const camIcon = size >= 100 ? 17 : 13
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
      const res = await uploadMyAvatar(fd)
      if (!res.ok) { setErr(res.error); return }
      setOpen(false)
      startTransition(() => router.refresh())
    } catch { setErr('Upload failed. Check your connection and try again.') }
    finally { setBusy(false) }
  }

  async function remove() {
    setBusy(true); setErr(null)
    try {
      const res = await removeMyAvatar()
      if (!res.ok) { setErr(res.error); return }
      startTransition(() => router.refresh())
    } catch { setErr('Could not remove. Check your connection and try again.') }
    finally { setBusy(false) }
  }

  return (
    <div className="shrink-0 text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <Avatar name={name} avatarUrl={avatarUrl} size={size} color={color} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Change photo"
          className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full bg-tn-primary border-2 border-white shadow-sm hover:brightness-110 transition"
          style={{ width: cam, height: cam }}
        >
          <svg width={camIcon} height={camIcon} viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
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
