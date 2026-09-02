'use client'

// The month, in the URL, so a particular month can be sent to somebody.
// Shared: the Grant Pass report and the hand-entry page both pick a month the
// same way, and `base` is the only thing that differs between them.

import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/Select'

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[m - 1]} ${y}`
}

export function MonthPicker(
  { months, selected, base }: { months: string[]; selected: string; base: string },
) {
  const router = useRouter()
  return (
    <div className="flex items-center gap-3">
      <label htmlFor="pm" className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">
        Month
      </label>
      <Select
        id="pm"
        value={selected}
        onChange={v => router.push(`${base}?month=${v}`)}
        options={months.map(m => ({ value: m, label: monthLabel(m) }))}
        ariaLabel="Month"
        className="px-3 py-2 rounded-[9px] border border-slate-200 text-sm bg-white text-tn-ink font-(family-name:--font-display) font-bold focus:outline-none focus:border-tn-teal focus:ring-2 focus:ring-tn-teal/20"
      />
    </div>
  )
}
