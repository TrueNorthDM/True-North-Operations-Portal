/**
 * The strip across the top of every page on the staging copy, so nobody takes
 * it for the real portal. Rendered only when IS_STAGING (lib/environment.ts).
 */
export function StagingBanner() {
  return (
    // Fixed height and on screen while scrolling: the rail and the drawers sit
    // below it through --banner-h (app/globals.css).
    <div className="sticky top-0 z-50 w-full h-[var(--banner-h)] leading-[var(--banner-h)] overflow-hidden whitespace-nowrap text-ellipsis bg-[#F2C40A] px-4 text-center text-[12.5px] font-semibold text-[#012358]">
      Staging: a test copy of the portal. Changes here never reach the real portal.{' '}
      <a href="https://truenorthportal.online" className="underline underline-offset-2">Open the real portal</a>
    </div>
  )
}
