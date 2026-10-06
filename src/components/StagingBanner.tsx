/**
 * The strip across the top of every page on the staging copy, so nobody takes
 * it for the real portal. Rendered only when IS_STAGING (lib/environment.ts).
 */
export function StagingBanner() {
  return (
    <div className="w-full bg-[#F2C40A] px-4 py-1.5 text-center text-[12.5px] font-semibold text-[#012358]">
      Staging: a test copy of the portal. Changes here never reach the real portal.{' '}
      <a href="https://truenorthportal.online" className="underline underline-offset-2">Open the real portal</a>
    </div>
  )
}
