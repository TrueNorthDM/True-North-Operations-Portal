// Instant response to a click that lands in this section: the list and a
// reimbursement document (/requests/reimbursements/<id>) meet here, so the
// one in requests/ is never seen between them. See (app)/loading.tsx.
import { PageSkeleton } from '@/components/ui/PageSkeleton'

export default function Loading() {
  return <PageSkeleton />
}
