/**
 * Pieces of the notification table (NotificationSettings) and its preview
 * window (NotificationPreview): the glyphs, the fixed "when", the category
 * pill, the admin's lock and the name cell.
 */

import { NavIcon } from '@/components/NavIcon'
import { CATEGORY_LABEL, timingIsChoice, type NotificationType, type Rule, type Timing } from '@/lib/notifications/catalogue'

export function LockGlyph({ open = false, size = 11 }: { open?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <path d="M5 11h14v10H5z" />
      <path d={open ? 'M8 11V7a4 4 0 0 1 7.5-2' : 'M8 11V7a4 4 0 0 1 8 0v4'} />
    </svg>
  )
}

export const BellGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
)
export const MailGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
    <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
  </svg>
)
export const EyeGlyph = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
  </svg>
)

export const TIMING: Record<Timing, { label: string; glyph: React.ReactNode }> = {
  instant: { label: 'As it happens', glyph: <BellGlyph /> },
  daily: { label: 'Daily summary', glyph: <MailGlyph /> },
}

/** One timing, not a choice: "Daily summary only", or the admin's fixed value with a lock. */
export function WhenFixed({ timing, only, locked, faded }: { timing: Timing; only?: boolean; locked?: boolean; faded?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-[6px] text-[12px] font-bold whitespace-nowrap ${faded ? 'text-muted' : 'bg-subtle text-tn-ink'}`}>
      {TIMING[timing].glyph}{TIMING[timing].label}
      {only && <span className="font-semibold text-muted">only</span>}
      {locked && <span className="text-[#8a6703]" title="Set by an admin"><LockGlyph /><span className="sr-only">Set by an admin</span></span>}
    </span>
  )
}

export function CategoryPill({ block }: { block: NotificationType['block'] }) {
  const cls = block === 'system' ? 'bg-[#efedfc] text-[#5b4bc4]' : 'bg-[rgba(30,125,127,.1)] text-tn-teal'
  return <span className={`inline-block rounded-full px-[9px] py-0.5 text-[10.5px] font-extrabold tracking-[.08em] uppercase font-(family-name:--font-display) ${cls}`}>{CATEGORY_LABEL[block]}</span>
}

/**
 * The admin's per-setting choice: people may change it (an open lock), or it
 * is fixed (a gold lock on navy). Square, so the rules table fits beside the
 * Admin panel. Its name says which setting it is, and stays the same:
 * aria-pressed says whether it is fixed (audit, 9 October 2026).
 */
export function FixToggle({ fixed, onChange, disabled, label }: { fixed: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={fixed}
      aria-label={`Fix for everyone: ${label}`}
      title={fixed ? 'Fixed for everyone. Click to let people change it.' : 'People can change it. Click to fix it for everyone.'}
      disabled={disabled}
      onClick={() => onChange(!fixed)}
      className={`shrink-0 w-7 h-7 rounded-[8px] inline-flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-default ${
        fixed ? 'bg-tn-primary text-[#F2C40A]' : 'bg-white text-[#b3bcc8] border border-[var(--panel-border)] hover:text-tn-ink'}`}
    >
      <LockGlyph open={!fixed} size={13} />
    </button>
  )
}

const WHEN_WORDS: Record<Timing, string> = { instant: 'always as it happens', daily: 'always in the daily summary' }

/** "Set by an admin: you can't turn it off, always as it happens." */
export function fixedSentence(t: NotificationType, r: Rule): string | null {
  if (r.fixEnabled && !r.enabled) return 'An admin turned this off for everyone.'
  const parts = [
    r.fixEnabled ? "you can't turn it off" : null,
    r.fixTiming && timingIsChoice(t) ? WHEN_WORDS[r.timing] : null,
  ].filter(Boolean)
  return parts.length ? `Set by an admin: ${parts.join(', ')}.` : null
}

export const TH = 'text-left font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.1em] uppercase text-muted bg-subtle px-4 py-2.5 border-b border-[var(--panel-border)] whitespace-nowrap'
export const TD = 'px-4 py-3 border-t border-[var(--row-rule)] align-middle'

export function NameCell({ t, faded, below }: { t: NotificationType; faded: boolean; below?: React.ReactNode }) {
  return (
    <td className={TD}>
      <div className="flex items-start gap-3 min-w-[220px]">
        <span className={`w-8 h-8 rounded-[9px] shrink-0 inline-flex items-center justify-center ${faded ? 'bg-subtle text-muted' : 'bg-[rgba(30,125,127,.1)] text-tn-teal'}`}>
          <NavIcon name={t.icon} size={16} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">{t.title}</span>
            {faded && <span className="rounded bg-[#fbf1cf] px-[5px] py-0.5 text-[9.5px] font-bold tracking-[.06em] text-[#8a6703]">NOT YET</span>}
          </div>
          <p className="text-[12px] text-muted m-0 mt-0.5 leading-snug">{faded ? t.blockedBy : `${t.description} Goes to: ${t.who.charAt(0).toLowerCase()}${t.who.slice(1)}.`}</p>
          {below}
        </div>
      </div>
    </td>
  )
}
