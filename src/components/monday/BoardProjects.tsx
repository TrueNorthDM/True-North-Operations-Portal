'use client'

/**
 * Linking Monday boards to timeclock projects.
 *
 * What it buys: the Workload tab's Load column multiplies open steps by an
 * hours-per-step figure. Unlinked, every board shares one average across the
 * whole company, so a translation step and a monthly report step are counted
 * as the same amount of work. Linked, a board is measured against its own
 * hours and the estimate audit says "measured" instead of "fallback".
 *
 * Boards carrying the most work come first, because linking the busiest ten
 * changes the numbers and linking the quietest hundred does not.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/Select'
import { SearchField } from '@/components/ui/SearchField'
import { chip } from '@/components/monday/tokens'
import { setBoardJobcode } from '@/app/(app)/admin/settings/monday/actions'

export type BoardLink = {
  id: number
  name: string
  workspaceName: string | null
  assignments: number
  jobcodeId: number | null
}

export function BoardProjects(
  { boards, jobcodes }: { boards: BoardLink[]; jobcodes: { id: number; name: string }[] },
) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const shown = boards.filter(b =>
    !q || `${b.name} ${b.workspaceName ?? ''}`.toLowerCase().includes(q))

  const linked = boards.filter(b => b.jobcodeId !== null).length

  const set = (boardId: number, value: string) => {
    start(async () => {
      await setBoardJobcode(boardId, value ? Number(value) : null)
      router.refresh()
    })
  }

  return (
    <div className={`space-y-3.5 transition-opacity ${pending ? 'opacity-60' : ''}`}>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-[13px] text-foreground">
          {`${linked} of ${boards.length} boards linked to a project`}
        </span>
        {linked === 0 ? (
          <span className={`${chip} bg-[rgba(224,138,30,.16)] text-[#b06d0a]`}>
            every estimate is the company average
          </span>
        ) : null}
      </div>

      <SearchField value={query} onChange={setQuery} placeholder="Board or workspace" />

      <div className="border border-[var(--panel-border)] rounded-[12px] overflow-hidden bg-white">
        {shown.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted m-0">No board matches that.</p>
        ) : shown.map((b, i) => (
          <div
            key={b.id}
            className={`flex items-center gap-3 px-4 py-2.5 ${i ? 'border-t border-[var(--row-rule)]' : ''}`}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-tn-ink truncate">{b.name}</span>
              <span className="block text-[11.5px] text-muted truncate">
                {b.workspaceName ?? 'No workspace'}
              </span>
            </span>

            <span className="flex-none text-[12px] text-muted w-24 text-right">
              {`${b.assignments.toLocaleString('en-US')} rows`}
            </span>

            <span className="flex-none w-64">
              <Select
                value={b.jobcodeId === null ? '' : String(b.jobcodeId)}
                onChange={v => set(b.id, v)}
                searchable
                fullWidth
                ariaLabel={`Project for ${b.name}`}
                options={[
                  // Named, not blank. "Company average" is what unlinked
                  // actually means, and a blank option looks like a mistake.
                  { value: '', label: 'Company average' },
                  ...jobcodes.map(j => ({ value: String(j.id), label: j.name })),
                ]}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
