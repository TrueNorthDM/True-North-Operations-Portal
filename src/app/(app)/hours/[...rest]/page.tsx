import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'

// My Hours' other pages (Reports, Approvals and Invoices) went with it into
// Clocky (16 October 2026): every old /hours/... link opens Time entries.
export default async function LegacyHoursPagesRedirect() {
  redirect(await previewHref('/clocky-hours'))
}
