// The i7 budget's status pill and usage-bar gradient, shared by the report's
// BudgetBalanceCard (a client component) and the compact card on Home (a
// server one). Kept out of I7CarryoverPanel.tsx: a 'use client' module hands a
// server component references, not these values.

import { BUDGET_STATUS_LABEL, PACE_STATUS_LABEL, type BudgetStatus, type PaceStatus } from '@/lib/tsheets/i7-view'
import { pillClass } from '@/components/ui/Pill'

// The status and its words are the PDF's too (lib/tsheets/i7-view.ts); the
// pill is the portal's one pill (components/ui/Pill), with its class whole.
export const BUDGET_PILL: Record<BudgetStatus, { cls: string; label: string }> = {
  good: { cls: pillClass('green'), label: BUDGET_STATUS_LABEL.good },
  warn: { cls: pillClass('amber'), label: BUDGET_STATUS_LABEL.warn },
  bad: { cls: pillClass('red'), label: BUDGET_STATUS_LABEL.bad },
  none: { cls: pillClass('gray'), label: BUDGET_STATUS_LABEL.none },
}

// The pace pill (owner, 11 November 2026): the screen and Home read the month against its pace.
export const PACE_PILL: Record<PaceStatus, { cls: string; label: string }> = {
  onpace: { cls: pillClass('green'), label: PACE_STATUS_LABEL.onpace },
  behind: { cls: pillClass('amber'), label: PACE_STATUS_LABEL.behind },
  ahead: { cls: pillClass('amber'), label: PACE_STATUS_LABEL.ahead },
  bad: { cls: pillClass('red'), label: PACE_STATUS_LABEL.bad },
  none: { cls: pillClass('gray'), label: PACE_STATUS_LABEL.none },
}

// Colours at real budget-% positions: yellowing past ~50%, red toward and over 100%.
export const BUDGET_GRADIENT = 'linear-gradient(90deg, #1E7D7F 0%, #31a39a 50%, #f59e0b 78%, #ef4444 100%)'
