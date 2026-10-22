'use client'

// The bell of Clock Safety.dc.html (frames N1, N3, N4) with the prototype's
// rows, in the real top-bar button and drawer. "Keep going" answers here
// instead of the server, as the prototype does. Development only.

import { NotificationButton } from '@/components/NotificationButton'
import type { KeepGoing, NotificationItem } from '@/components/NotificationDrawer'
import { rowsFor, type Level } from './rows'

const keepGoing: KeepGoing = async () => ({
  ok: true,
  toastFromBell: 'Keep going. Your clock runs another 5h from now.',
  done: 'You kept going at 12:31 PM. North Time asks again in 4h 30m.',
})

export function BellCheck({ level }: { level: Level }) {
  const tools: NotificationItem[] = rowsFor(level)
  return <NotificationButton kind="bell" startOpen items={{ tools, system: [] }} keepGoing={keepGoing} />
}
