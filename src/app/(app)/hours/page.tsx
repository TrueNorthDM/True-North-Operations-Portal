import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'

// My Hours became Clocky's Time entries (owner's decision, 16 October 2026,
// docs/time-clock/05-clocky-build.md): one Clocky hub for every level. Kept so
// old /hours links land on the person's own hours.
export default async function LegacyHoursRedirect() {
  redirect(await previewHref('/clocky-hours'))
}
