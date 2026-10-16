// The bell rows of Clock Safety.dc.html, per level, as loadInbox would hand
// them to the drawer (lib/notifications/inbox.ts): the title is the sentence,
// the button comes from the catalogue. The times are the prototype's own.

import type { NotificationItem } from '@/components/NotificationDrawer'
import { TYPE_BY_KEY } from '@/lib/notifications/catalogue'

export type Level = 'super' | 'admin' | 'lead' | 'user'

const row = (id: string, type: string, when: string, text: string, unread: boolean, href = '/clocky-hours'): NotificationItem => {
  const t = TYPE_BY_KEY.get(type)!
  return { id, type, who: text, what: '', when, src: t.src, icon: t.icon, href, unread, ...(t.button ? { button: t.button } : {}) }
}

const REQ = [
  { team: 'Social Media', when: '8:40 AM', text: 'Clarise Nixon asked for a time correction: 1h 30m on Wed, Oct 14, 3:00 PM to 4:30 PM.' },
  { team: 'Web', when: 'Tue, 5:20 PM', text: 'Samuel Manzi asked for a time correction: 1h 00m on Tue, Oct 13, 4:00 PM to 5:00 PM.' },
  { team: 'Social Media', when: 'Tue, 9:05 AM', text: 'Stephanie Aguirre asked for a time correction: 0h 45m on Mon, Oct 12, 5:30 PM to 6:15 PM.' },
]

export function rowsFor(level: Level): NotificationItem[] {
  const approvals = level === 'user' ? [] : [
    ...REQ.filter(r => level !== 'lead' || r.team === 'Web')
      .map((r, i) => row(`req-${i}`, 'clocky-correction-requested', r.when, r.text, true, '/clocky-hours/approvals')),
    ...(level === 'super' ? [row('off', 'clocky-timeoff-requested', 'Oct 9', 'Olivia Hale asked for time off: Vacation, Fri, Oct 16 (8h 00m).', true, '/clocky-hours/approvals')] : []),
  ]
  const outcome = level !== 'user' ? [] : [
    row('ok', 'clocky-correction-decided', '11:05 AM', 'Rock Kai approved your time correction: 1h 30m on Wed, Oct 14. It now counts in your hours.', true),
    row('no', 'clocky-correction-decided', 'Fri, 9:30 AM', 'Rock Kai denied your time correction for Thu, Oct 8 (0h 30m). Reason: "That half hour is already in your Oct 8 entries."', false),
  ]
  return [
    ...approvals,
    ...outcome,
    row('still', 'clocky-still-working', '12:30 PM', 'Still working? Your clock has been running 4h 30m since you clocked in at 8:00 AM. It stops at 5h 00m unless you keep it going.', true, '/clocky-hours?clock=open'),
    row('stop', 'clocky-stopped', '1:00 PM', 'Your clock stopped by itself at 1:00 PM. Confirm when you really stopped.', true, '/clocky-hours?clock=open'),
    ...(level === 'super' ? [row('sum', 'clocky-auto-stops', '7:00 AM', '2 automatic clock-outs yesterday: Wendy Cacka, Justus Tsofa.', false, '/clocky-hours/safety')] : []),
  ]
}
