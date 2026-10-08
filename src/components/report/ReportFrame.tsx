'use client'

// Screen 6.3: switching scope or period dims the current table instead of
// blanking the page.
//
// Same behaviour as My Work, and for the same reason: these controls get
// clicked repeatedly, and a page that empties and refills on every click
// bounces the layout under the cursor. Keeping the previous numbers on screen
// at 60% says "these are about to change" without moving anything.

import { createContext, useContext, useTransition } from 'react'
import { withViewAs } from '@/components/ViewAsKeeper'
import { useRouter } from 'next/navigation'

type Nav = { pending: boolean; go: (href: string) => void }

const NavContext = createContext<Nav>({ pending: false, go: () => {} })

export function useReportNav(): Nav {
  return useContext(NavContext)
}

export function ReportNav({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <NavContext.Provider value={{ pending, go: href => startTransition(() => router.push(withViewAs(href))) }}>
      {children}
    </NavContext.Provider>
  )
}

/** Wraps whatever the controls are about to replace. */
export function DimWhilePending({ children }: { children: React.ReactNode }) {
  const { pending } = useReportNav()
  return (
    <div className={`transition-opacity ${pending ? 'opacity-60' : ''}`} aria-busy={pending}>
      {children}
    </div>
  )
}
