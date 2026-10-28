// Design check: the Time entries list with the job in one column (today) or in
// Client, Division and Project columns (owner, 28 October 2026). The rows are
// the owner's week on staging, Oct 25 to 31. Development only.

import { notFound } from 'next/navigation'
import { ColumnsCheck } from './ColumnsCheck'

export const dynamic = 'force-dynamic'

export default function EntriesColumnsCheck() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <ColumnsCheck />
}
