'use client'

/**
 * A guide page's videos beside its header (owner, 18 November 2026, option C):
 * the shell hands the page's videos down, and the guide's header puts them on
 * its right, beside the title and the opening text. Narrower windows show them
 * under the opening text. A page with no videos keeps its plain header.
 */

import { createContext, useContext, type ReactNode } from 'react'
import type { ManualVideoRef } from '@/lib/manual/registry'
import { VimeoPlayer } from './ManualVideo'

const Videos = createContext<{ videos: readonly ManualVideoRef[]; title: string }>({ videos: [], title: '' })

export function GuideVideosProvider({ videos, title, children }: { videos: readonly ManualVideoRef[]; title: string; children: ReactNode }) {
  return <Videos value={{ videos, title }}>{children}</Videos>
}

export function GuideHeaderFrame({ children }: { children: ReactNode }) {
  const { videos, title } = useContext(Videos)
  if (!videos.length) return <header className="flex flex-col gap-2">{children}</header>
  return (
    <header className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_440px] gap-x-8 gap-y-5 items-start">
      <div className="flex flex-col gap-2 min-w-0">{children}</div>
      <div className="flex flex-col gap-4 min-w-0 max-w-[560px] xl:max-w-none">
        {videos.map(v => <VimeoPlayer key={v.vimeo} video={v} title={title} />)}
      </div>
    </header>
  )
}
