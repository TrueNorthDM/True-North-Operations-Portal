// AAAF — Run Link audit (Server Component)

import { getHreflangAudit } from '@/lib/hreflang/audit'
import { HreflangAuditView } from '@/components/HreflangAuditView'

export default async function AaafAuditPage() {
  const audit = await getHreflangAudit('aaaf')
  return <HreflangAuditView audit={audit} siteCode="aaaf" />
}
