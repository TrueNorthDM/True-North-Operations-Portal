// The instant response to a click while Who's working renders on the server
// (see app/(app)/loading.tsx for why each folder with a page has its own).
import { PageSkeleton } from '@/components/ui/PageSkeleton'

export default function Loading() {
  return <PageSkeleton />
}
