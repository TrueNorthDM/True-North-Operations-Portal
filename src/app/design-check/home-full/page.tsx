// Design check: the whole new Home (design_handoff_home, 25 October 2026) on
// the prototype's sample, with its switches (level, Pay period, Bessemeters),
// in the page's own layout inside the padding MainContent gives a page. The
// same Home inside the portal's shell: /design-check/rail?page=home.
// /design-check/home-full?home=super|admin|lead|emp|con&pay=auto|running|today|late|sent&bess=0|1

import { NewHome, HomeSwitches, readChoice } from './NewHome'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const choice = readChoice(await searchParams)
  return (
    <div className="min-h-screen bg-background">
      <HomeSwitches choice={choice} base="/design-check/home-full" />
      <div className="px-6 py-8">
        <NewHome choice={choice} />
      </div>
    </div>
  )
}
