/**
 * The System manual's tutorial videos (owner, 17 and 18 November 2026): Vimeo's
 * player, 16:9, with an optional label above it ("For Admins"). dnt=1 keeps
 * Vimeo from tracking the viewer; an unlisted video plays only with its code.
 */

import type { ManualVideoRef } from '@/lib/manual/registry'

/** The player's address for "number" or "number/code" (the end of the vimeo.com link). */
export function vimeoSrc(ref: string): string | null {
  const m = /^(\d+)(?:\/([0-9a-f]+))?$/.exec(ref)
  if (!m) return null
  return `https://player.vimeo.com/video/${m[1]}?${m[2] ? `h=${m[2]}&` : ''}dnt=1&title=0&byline=0&portrait=0`
}

export function VimeoPlayer({ video, title }: { video: ManualVideoRef; title: string }) {
  const src = vimeoSrc(video.vimeo)
  if (!src) return null
  return (
    <figure className="m-0 flex flex-col gap-1.5 min-w-0">
      {video.label && <figcaption className="font-(family-name:--font-display) font-extrabold text-[11px] uppercase tracking-[.09em] text-tn-teal">{video.label}</figcaption>}
      <div className="relative w-full overflow-hidden rounded-[14px] border border-[var(--panel-border)] bg-[#0B2447] aspect-video">
        <iframe src={src} title={`${title}: video tutorial${video.label ? ` (${video.label.toLowerCase()})` : ''}`}
          className="absolute inset-0 w-full h-full border-0" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" />
      </div>
    </figure>
  )
}
