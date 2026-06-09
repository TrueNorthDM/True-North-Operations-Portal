// HFA — Run Link audit (Server Component)

import { getHreflangAudit } from '@/lib/hreflang/audit'
import { HreflangAuditView } from '@/components/HreflangAuditView'

export default async function HfaAuditPage() {
  const audit = await getHreflangAudit('hfa')
  return <HreflangAuditView audit={audit} siteCode="hfa" />
}
