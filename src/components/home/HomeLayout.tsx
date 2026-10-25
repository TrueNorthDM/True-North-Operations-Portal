// Home's grid (design_handoff_home, README "Layout", 25 October 2026): the
// banner full bleed across the content area, then a grid with 28px around it.
// Left, Needs you (row 1, stretched to the right column's height, its list
// scrolling inside) over the Pay period (row 2, natural height); right, the
// Agenda and the i7 budget across both rows; Publishing goals across the
// bottom. Below lg, one column in that order.
//
// The page and its design check both draw it, so the preview shows the real
// layout. A slot left null takes no room, and neither does one whose widget
// drew nothing once it read (audit, 25 October 2026: Publishing with no
// boards, an empty right column): each slot is display:none while :empty
// (React's Suspense markers are comments, which :empty ignores), and with the
// right column empty the grid is one column. Needs you and the Pay period
// share a column of their own, so an empty Pay period leaves no gap under
// Needs you.

export function HomeLayout({ banner, needs, pay, right, publishing }: {
  banner: React.ReactNode
  needs: React.ReactNode
  pay: React.ReactNode
  right: React.ReactNode
  publishing: React.ReactNode
}) {
  return (
    // MainContent pads the page 24px by 32px; Home runs edge to edge instead.
    <div className="-mx-6 -mt-8 -mb-8">
      {banner}
      <div className="p-7 grid grid-cols-1 gap-y-[22px] items-start lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-x-6 lg:[&:has(>[data-slot=right]:empty)]:grid-cols-1">
        {(needs || pay) && (
          <div className="min-w-0 lg:col-start-1 lg:row-start-1 self-stretch flex flex-col gap-[22px]">
            {needs && <div className="min-w-0 lg:flex-1 flex flex-col [&>*]:flex-1 empty:hidden">{needs}</div>}
            {pay && <div className="min-w-0 empty:hidden">{pay}</div>}
          </div>
        )}
        {right && <div data-slot="right" className="min-w-0 lg:col-start-2 lg:row-start-1 flex flex-col gap-5 empty:hidden">{right}</div>}
        {publishing && <div className="min-w-0 lg:col-[1/-1] lg:row-start-2 empty:hidden">{publishing}</div>}
      </div>
    </div>
  )
}
