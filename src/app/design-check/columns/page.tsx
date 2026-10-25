// Design check: the Columns menus (owner, 25 October 2026), the real screens
// with nothing behind them.
//   /design-check/columns                      Rates & Costs, every column shown
//   ?table=directory                           the Directory (People, Emails, Access log, Portal access)
//   ?hide=team,joined                          start with these columns hidden (the table on screen;
//                                              on the Directory, the People tab)
//   ?fail=1                                    every save fails: the columns go back and say so
// Development only.

import { notFound } from 'next/navigation'
import { ColumnsCheck } from './ColumnsCheck'

export const dynamic = 'force-dynamic'

export default async function ColumnsDesignCheck({ searchParams }: { searchParams: Promise<{ table?: string; hide?: string; fail?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { table: t, hide, fail } = await searchParams
  const table = t === 'directory' ? 'directory' : 'rates'
  const keys = hide ? hide.split(',').map(k => k.trim()).filter(Boolean) : null
  const hidden = keys ? { [table === 'rates' ? 'rates' : 'directory-people']: keys } : {}
  return <ColumnsCheck table={table} hidden={hidden} fail={fail === '1'} />
}
