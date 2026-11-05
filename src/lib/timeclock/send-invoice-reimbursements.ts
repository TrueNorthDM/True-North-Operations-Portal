/**
 * Which reimbursements a send may put on an invoice, on its own so the send
 * screen in the browser can use it without the server's data code.
 */

export interface SendableReimbursement { id: number; label: string; purpose: string; amount: number }

/**
 * What a send may put on the invoice for a period: the approved ones waiting
 * for an invoice, and the ones still on its invoice sent back to them.
 */
export const reimbursementsFor = (
  data: { reimbursements: readonly SendableReimbursement[] },
  period: { returned: { reimbursements: readonly SendableReimbursement[] } | null },
): SendableReimbursement[] => [...data.reimbursements, ...(period.returned?.reimbursements ?? [])]
