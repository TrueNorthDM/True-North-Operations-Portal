// Instant response to a click that lands in this section. See (app)/loading.tsx
// for why this folder needs its own rather than relying on the one above it.
import { PageSkeleton } from '@/components/ui/PageSkeleton'

export default function Loading() {
  return <PageSkeleton />
}
