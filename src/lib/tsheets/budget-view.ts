/**
 * Whether a person reads the i7 budget in hours or in dollars (owner, 11
 * November 2026): chosen on the i7 report, followed by Home's i7 widget. Hours
 * unless they chose dollars. A read that fails keeps the default.
 *
 * Server only.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { BudgetUnit } from './i7-view'

export const DEFAULT_BUDGET_UNIT: BudgetUnit = 'hours'

export const readBudgetUnit = (v: unknown): BudgetUnit => (v === 'dollars' ? 'dollars' : 'hours')

export async function loadBudgetUnit(personId: string | null | undefined): Promise<BudgetUnit> {
  if (!personId) return DEFAULT_BUDGET_UNIT
  const { data, error } = await createAdminClient().from('person_settings').select('i7_budget_view').eq('person_id', personId).maybeSingle()
  if (error) {
    console.error('[i7] budget view read:', error.message)
    return DEFAULT_BUDGET_UNIT
  }
  return readBudgetUnit(data?.i7_budget_view)
}
