import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { HealthResult } from '@/lib/health/checks'

const access = vi.hoisted(() => ({ can: vi.fn() }))
const health = vi.hoisted(() => ({ latest: vi.fn() }))
vi.mock('@/lib/access/resolve', () => ({ loadAccess: async () => ({ can: access.can }), allowedTo: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/health/checks', async orig => ({ ...(await orig()), latestHealth: health.latest }))

import { SystemHealthBanner } from './SystemHealthBanner'

const fresh = new Date().toISOString()
const row = (service: string, status: HealthResult['status'], detail = 'detail', checked_at = fresh): HealthResult =>
  ({ service, ok: status === 'ok', status, detail, checked_at })

async function show() {
  const el = await SystemHealthBanner()
  if (el) render(el)
  return el
}

beforeEach(() => {
  access.can.mockReset().mockReturnValue(true)
  health.latest.mockReset()
})

describe('SystemHealthBanner (audit, 10 October 2026)', () => {
  it('shows nothing when every service is fine', async () => {
    health.latest.mockResolvedValue({ results: { monday_api: row('monday_api', 'ok') }, readError: null })
    expect(await show()).toBeNull()
  })

  it('shows nothing without home-health, read through loadAccess', async () => {
    access.can.mockReturnValue(false)
    health.latest.mockResolvedValue({ results: { monday_api: row('monday_api', 'down') }, readError: null })
    expect(await show()).toBeNull()
    expect(access.can).toHaveBeenCalledWith('home-health')
  })

  it('is a red alert for a service down, naming it with its detail', async () => {
    health.latest.mockResolvedValue({
      results: { monday_api: row('monday_api', 'down', 'Token rejected.'), tsheets_api: row('tsheets_api', 'warn', 'Slow.') },
      readError: null,
    })
    await show()
    const box = screen.getByRole('alert')
    expect(box).toHaveTextContent('Monday API is down')
    expect(box).toHaveTextContent('Token rejected.')
    expect(box).toHaveTextContent('TSheets API (warning): Slow.')
    expect(screen.getByRole('link')).toHaveAttribute('href', '/admin/automations')
  })

  it('is an amber status for warnings only', async () => {
    health.latest.mockResolvedValue({ results: { daily_summary: row('daily_summary', 'warn', 'One email failed.') }, readError: null })
    await show()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Daily summary email has a warning')
  })

  it('says when the checks have not run', async () => {
    const old = new Date(Date.now() - 12 * 3_600_000).toISOString()
    health.latest.mockResolvedValue({ results: { monday_api: row('monday_api', 'ok', 'fine', old) }, readError: null })
    await show()
    const box = screen.getByRole('alert')
    expect(box).toHaveTextContent('Health checks have not run')
    expect(box).toHaveTextContent(/have not run since .* ET/)
  })

  it('shows nothing when the results cannot be read', async () => {
    health.latest.mockResolvedValue({ results: {}, readError: 'The health results could not be read just now.' })
    expect(await show()).toBeNull()
  })
})
