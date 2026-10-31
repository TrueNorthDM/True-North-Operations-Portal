/**
 * The public privacy policy and terms (owner, 30 October 2026): the pages
 * Google asks for before the portal's Google sign-in leaves Internal mode.
 * No portal shell and no login: anyone, Google's reviewers included, reads them.
 */

import Image from 'next/image'
import Link from 'next/link'

export const UPDATED = 'October 30, 2026'
export const CONTACT = 'office@truenorthdigitalmarketing.com'

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex-1 bg-[#f4f2ec] px-4 py-8 flex flex-col items-center gap-5">
      <Image src="/logos/true-north.png" alt="True North Digital Marketing" width={1352} height={705} priority className="h-10 w-auto" />
      <article className="bg-white rounded-[20px] shadow-[0_10px_30px_rgba(1,35,88,.10)] w-full max-w-[860px] px-6 py-8 md:px-10 flex flex-col gap-4 text-[15px] leading-[1.6] text-foreground">
        <header className="flex flex-col gap-1">
          <h1 className="m-0 font-(family-name:--font-display) font-black text-[28px] text-tn-ink">{title}</h1>
          <p className="m-0 text-[13px] text-muted">True North Operations Portal. Last updated {UPDATED}.</p>
        </header>
        {children}
      </article>
      <nav className="flex gap-4 text-[13px]">
        <Link href="/legal/privacy" className="text-tn-teal font-bold">Privacy policy</Link>
        <Link href="/legal/terms" className="text-tn-teal font-bold">Terms of use</Link>
      </nav>
    </main>
  )
}

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="m-0 mt-3 font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">{children}</h2>
}

export function List({ items }: { items: React.ReactNode[] }) {
  return <ul className="m-0 pl-5 flex flex-col gap-1.5">{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
}
