// Design checks are for development only. Most pages refuse a production build
// themselves; this closes the whole folder there, so one that forgets cannot
// show its sample data (some of it copied from real boards) to anyone signed in.

import { notFound } from 'next/navigation'

export default function DesignCheckLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return children
}
