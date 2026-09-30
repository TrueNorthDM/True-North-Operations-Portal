// Design check: the old portal's maintenance page on switch-over day
// (migration plan, step p6-freeze). Development only.

import { notFound } from 'next/navigation'
import { MaintenanceView } from '@/components/MaintenanceView'

export default function MaintenanceCheck() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <MaintenanceView newAddress="truenorthportal.online" />
}
