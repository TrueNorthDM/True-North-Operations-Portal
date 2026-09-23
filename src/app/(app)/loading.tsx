// The instant response to a click, while the page renders on the server.
//
// One of these sits in every folder where two different pages can meet on a
// navigation, not only here. On a client navigation Next.js re-renders only below
// the layout the two routes share, so a loading file above that point is never
// seen: measured on this version, the tools hub to the i7 report blocked for the full
// render with a loading file in (app) and none in tools. The folders were found by
// walking the route tree, and a new folder with pages under it needs its own.
// See components/ui/PageSkeleton.tsx.
import { PageSkeleton } from '@/components/ui/PageSkeleton'

export default function Loading() {
  return <PageSkeleton />
}
