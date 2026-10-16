import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
const reads = vi.hoisted(() => ({ markNotificationsRead: vi.fn(async () => ({ ok: true })), markTabRead: vi.fn(async () => ({ ok: true })) }))
const clock = vi.hoisted(() => ({ keepGoing: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/app/(app)/notifications/actions', () => reads)
vi.mock('@/app/(app)/clocky-hours/clock-actions', () => clock)

import { NotificationDrawer, clockyTone, type NotificationItem } from './NotificationDrawer'

// Clocky's rows in the bell (design handoff of 16 October 2026, Clock
// Safety.dc.html frames N1, N3, N4): the sentence, one button, or what was done.

const row = (o: Partial<NotificationItem>): NotificationItem => ({
  id: 'n1', who: '', what: '', when: '8:40 AM', src: 'Clocky', icon: 'clocky', href: '/clocky-hours', unread: true, ...o,
})
const REVIEW = row({ id: 'req', type: 'clocky-correction-requested', src: 'Clocky · approvals', href: '/clocky-hours/approvals', who: 'Samuel Manzi asked for a time correction: 1h 00m on Tue, Oct 13, 4:00 PM to 5:00 PM.', button: { label: 'Review', href: '/clocky-hours/approvals' } })
const STILL = row({ id: 'still', type: 'clocky-still-working', href: '/clocky-hours?clock=open', who: 'Still working? Your clock has been running 4h 30m since you clocked in at 8:00 AM. It stops at 5h 00m unless you keep it going.', button: { label: 'Keep going', action: 'keep-going' } })
const STOPPED = row({ id: 'stop', type: 'clocky-stopped', href: '/clocky-hours?clock=open', who: 'Your clock stopped by itself at 1:00 PM. Confirm when you really stopped.', button: { label: 'Confirm end time', action: 'open-clock' } })

function drawer(items: NotificationItem[], keepGoing?: Parameters<typeof NotificationDrawer>[0]['keepGoing']) {
  const onClose = vi.fn()
  const onRead = vi.fn()
  render(<NotificationDrawer kind="bell" tab="tools" onTab={() => {}} items={{ tools: items, system: [] }} read={new Set()} onRead={onRead} onClose={onClose} keepGoing={keepGoing} />)
  return { onClose, onRead }
}

beforeEach(() => {
  router.push.mockReset(); router.refresh.mockReset(); clock.keepGoing.mockReset()
  reads.markNotificationsRead.mockClear()
})

describe('Clocky in the bell', () => {
  it('shows the sentence and its source, and Review opens Approvals', () => {
    const { onClose } = drawer([REVIEW])
    expect(screen.getByText(REVIEW.who)).toBeInTheDocument()
    expect(screen.getByText('Clocky · approvals')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    expect(router.push).toHaveBeenCalledWith('/clocky-hours/approvals')
    expect(onClose).toHaveBeenCalled()
    expect(reads.markNotificationsRead).toHaveBeenCalledWith(['req'])
  })

  it('opens the clock panel from "Confirm end time"', () => {
    drawer([STOPPED])
    fireEvent.click(screen.getByRole('button', { name: 'Confirm end time' }))
    expect(router.push).toHaveBeenCalledWith('/clocky-hours?clock=open')
  })

  it('keeps the clock going from the bell, with the toast and the done line', async () => {
    const keepGoing = vi.fn(async () => ({ ok: true as const, toastFromBell: 'Keep going. Your clock runs another 5h from now.', done: 'You kept going at 12:31 PM. Clocky asks again in 4h 30m.' }))
    const { onRead } = drawer([STILL], keepGoing)
    fireEvent.click(screen.getByRole('button', { name: 'Keep going' }))
    await waitFor(() => expect(screen.getByText('You kept going at 12:31 PM. Clocky asks again in 4h 30m.')).toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('Keep going. Your clock runs another 5h from now.')
    expect(screen.queryByRole('button', { name: 'Keep going' })).toBeNull()
    expect(onRead).toHaveBeenCalledWith(['still'])
    expect(router.refresh).toHaveBeenCalled()
  })

  it('calls Clocky itself when no stand-in is given, and says why it refused', async () => {
    clock.keepGoing.mockResolvedValue({ ok: false, error: 'You are not clocked in.' })
    drawer([STILL])
    fireEvent.click(screen.getByRole('button', { name: 'Keep going' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('You are not clocked in.')
    expect(clock.keepGoing).toHaveBeenCalled()
  })

  it('shows what was done instead of the button', () => {
    drawer([{ ...STILL, unread: false, done: 'You kept going at 12:31 PM. Clocky asks again in 4h 30m.' }])
    expect(screen.queryByRole('button', { name: 'Keep going' })).toBeNull()
    expect(screen.getByText('You kept going at 12:31 PM. Clocky asks again in 4h 30m.')).toBeInTheDocument()
  })

  it('colours each kind as the design does', () => {
    expect(clockyTone({ type: 'clocky-stopped', who: '' }).fg).toBe('#c8323d')
    expect(clockyTone({ type: 'clocky-correction-decided', who: 'Rock Kai approved your time correction: 1h 30m on Wed, Oct 14.' }).fg).toBe('var(--ok-fg)')
    expect(clockyTone({ type: 'clocky-correction-decided', who: 'Rock Kai denied your time correction for Thu, Oct 8 (0h 30m). Reason: "x"' }).fg).toBe('#c8323d')
    expect(clockyTone({ type: 'clocky-auto-stops', who: '' }).fg).toBe('var(--color-tn-teal)')
  })
})
