// North Time's pages: the closed line on top while North Time is not open (migration 132).
import { NorthTimeClosedBanner } from '@/components/clocky/NorthTimeClosedBanner'

export default function NorthTimeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NorthTimeClosedBanner />
      {children}
    </>
  )
}
