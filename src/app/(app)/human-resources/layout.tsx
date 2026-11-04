// Human Resources: every page here draws the annual review's state colours
// (lib/review/colors.ts). `contents` keeps the wrapper out of the layout.

import { APR_COLORS } from '@/lib/review/colors'

export default function HumanResourcesLayout({ children }: { children: React.ReactNode }) {
  return <div className="contents" style={APR_COLORS}>{children}</div>
}
