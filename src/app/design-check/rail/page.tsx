// Design check: the rail in groups, Settings and the avatar at its foot, and
// the notification bell in the top bar (21 September 2026). The real
// components, as an admin would see them; ?level=user shows what an ordinary
// level gets, ?open=menu the account menu, ?open=bell the notifications.
// Development only.

import { notFound } from 'next/navigation'
import Image from 'next/image'
import { Sidebar } from '@/components/Sidebar'
import { NotificationBell } from '@/components/NotificationBell'

export const dynamic = 'force-dynamic'

const ADMIN = ['home', 'tools', 'my-work', 'my-hours', 'directory', 'human-resources', 'admin', 'clocky-hours', 'settings']
const USER = ['home', 'tools', 'my-work', 'my-hours', 'directory']

export default async function RailDesignCheck({ searchParams }: { searchParams: Promise<{ level?: string; open?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { level, open } = await searchParams
  const allowed = level === 'user' ? USER : ADMIN
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* The development badge sits where the avatar is; this page is for looking at the avatar. */}
      <style>{'nextjs-portal{display:none!important}'}</style>
      <header className="border-b border-slate-200 bg-white px-6 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-20">
        <span className="flex items-end gap-2.5">
          <Image src="/logos/true-north.png" alt="True North Digital Marketing" width={1352} height={705} priority className="h-9 w-auto" />
          <span className="text-sm font-semibold text-slate-500 pb-0.5">Operations Portal</span>
        </span>
        <div className="flex items-center gap-2"><NotificationBell startOpen={open === 'bell'} /></div>
      </header>
      <div className="flex flex-1">
        <Sidebar
          allowed={allowed}
          menuOpen={open === 'menu'}
          user={{ email: 'arnaldo@leveluponline.org', name: 'Arnaldo Oliveira', avatarUrl: 'https://xoahdamwwgogfhyawogs.supabase.co/storage/v1/object/public/avatars/d95bae40-e85b-49ff-a203-e8da8a92a129.jpg?v=1784323484508' }}
        />
        <main className="flex-1 p-8">
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check · as built</p>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[24px] text-tn-ink m-0">{level === 'user' ? 'The rail, as an ordinary level' : 'The rail, as an admin'}</h1>
        </main>
      </div>
    </div>
  )
}
