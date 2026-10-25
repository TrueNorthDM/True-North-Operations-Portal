// The i7 budget's status pill and usage-bar gradient, shared by the report's
// BudgetBalanceCard (a client component) and the compact card on Home (a
// server one). Kept out of I7CarryoverPanel.tsx: a 'use client' module hands a
// server component references, not these values.

import { BUDGET_STATUS_LABEL, type BudgetStatus } from '@/lib/tsheets/i7-view'

// The status and its words are the PDF's too (lib/tsheets/i7-view.ts).
export const BUDGET_PILL: Record<BudgetStatus, { cls: string; label: string }> = {
  good: { cls: 'text-[#1E9E6A] bg-[#eafaf1] border-[#c3ead5]', label: BUDGET_STATUS_LABEL.good },
  warn: { cls: 'text-amber-700 bg-amber-50 border-amber-200', label: BUDGET_STATUS_LABEL.warn },
  bad: { cls: 'text-red-700 bg-red-50 border-red-200', label: BUDGET_STATUS_LABEL.bad },
  none: { cls: 'text-slate-500 bg-slate-100 border-slate-200', label: BUDGET_STATUS_LABEL.none },
}

// Colours at real budget-% positions: yellowing past ~50%, red toward and over 100%.
export const BUDGET_GRADIENT = 'linear-gradient(90deg, #1E7D7F 0%, #31a39a 50%, #f59e0b 78%, #ef4444 100%)'
