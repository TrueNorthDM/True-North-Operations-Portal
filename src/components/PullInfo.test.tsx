import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/tsheets/sync-actions', () => ({ syncAllFromTsheets: vi.fn() }))

import { PullInfo, etSchedule } from './PullInfo'
import { SyncStatus } from './tsheets/settings/SyncStatus'

describe('PullInfo and SyncStatus in ET (audit, 10 October 2026)', () => {
  it('lists the UTC cron hours as ET times in day order, 12-hour', () => {
    // 10 October is daylight time: UTC-4.
    const on = new Date('2026-10-10T12:00:00Z')
    expect(etSchedule([1, 5, 9, 13, 17, 21], 0, on)).toBe('1:00 AM, 5:00 AM, 9:00 AM, 1:00 PM, 5:00 PM and 9:00 PM ET')
    // January is standard time: UTC-5, so the same cron lands an hour earlier.
    expect(etSchedule([1, 13], 30, new Date('2026-01-10T12:00:00Z'))).toBe('8:30 AM and 8:30 PM ET')
  })

  it('writes the last pull as an ET moment', () => {
    render(<PullInfo syncedAt="2026-10-09T19:05:00Z" utcHours={[1]} label="Boards pulled" pastVerb="pulled" />)
    expect(screen.getByText(/last pulled Oct 9, 2026, 3:05 PM ET/)).toBeInTheDocument()
  })

  it('SyncStatus writes the sync as an ET moment', () => {
    render(<SyncStatus syncedAt="2026-10-09T19:05:00Z" />)
    expect(screen.getByText('Last synced Oct 9, 2026, 3:05 PM ET')).toBeInTheDocument()
  })
})
