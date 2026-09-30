// The old portal's page on switch-over day (deploy/SWITCH-OVER.md, step
// p6-freeze). The proxy shows it for every page while MAINTENANCE_MODE is on;
// with the switch off, the address just goes home.

import { redirect } from 'next/navigation'
import { MaintenanceView } from '@/components/MaintenanceView'
import { maintenanceOn } from '@/lib/switch-over'

export const dynamic = 'force-dynamic'

export default function MaintenancePage() {
  if (!maintenanceOn(process.env.MAINTENANCE_MODE)) redirect('/')
  return <MaintenanceView newAddress="truenorthportal.online" />
}
