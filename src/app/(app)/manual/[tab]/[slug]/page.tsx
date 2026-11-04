// One page of the System manual (owner, 4 November 2026): a guide or a page
// of Behind the portal, in the manual's frame. Open to everyone (the manual
// item is always on); the Super Admins only pages ask for How it runs
// (man-runs), as that tab did: they name the server, its accounts and keys.

import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'
import { requireSurface } from '@/lib/access/resolve'
import { CATALOGUE, ITEM } from '@/lib/access/catalogue'
import { isTab, pageOf } from '@/lib/manual/registry'
import { ManualShell } from '@/components/manual/ManualShell'
import { ManualContent } from '@/components/manual/ManualContent'

/**
 * The catalogue's Super Admin only items, for the Access model page. Read here
 * on the server because client code never imports the catalogue (it names
 * every page, Super Admin ones included). A tab or action reads with its
 * page: "Company settings > APIs & tokens".
 */
function superOnlyLabels(): string[] {
  return CATALOGUE.filter(i => i.superOnly).map(i => {
    const label = i.label.replace(', with Check a person, Exceptions and the change log', '')
    const parent = i.parent ? ITEM.get(i.parent) : undefined
    return (i.kind === 'tab' || i.kind === 'action') && parent ? `${parent.label} > ${label}` : label
  })
}

type Params = Promise<{ tab: string; slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tab, slug } = await params
  const page = isTab(tab) ? pageOf(tab, slug) : null
  return { title: page ? `${page.title} · System manual` : 'System manual' }
}

export default async function ManualPageRoute({ params }: { params: Params }) {
  const access = await requireSurface('manual')
  const { tab, slug } = await params
  const page = isTab(tab) ? pageOf(tab, slug) : null
  if (!page) notFound()
  const superAdmin = access.can('man-runs')
  if (page.superOnly && !superAdmin) redirect(await previewHref('/manual'))
  return (
    <ManualShell tab={page.tab} page={page} superAdmin={superAdmin}>
      <ManualContent slug={page.slug} superOnly={page.slug === 'access-model' ? superOnlyLabels() : []} />
    </ManualShell>
  )
}
