'use client'

/**
 * "Full history" ⇄ "Back to settings" toggle. Rendered inside the Clients &
 * budgets action row (opens the change-history view) and inside the history
 * view header (returns to settings). Reads the toggle from HistoryContext, which
 * SettingsNav provides.
 */

import { useHistory } from './history-context'

export function FullHistoryButton() {
  const { isHistory, toggle } = useHistory()
  return (
    <button
      type="button"
      onClick={toggle}
      className={`ml-auto inline-flex items-center gap-2 rounded-full px-[17px] py-2.5 font-(family-name:--font-display) font-extrabold text-[12.5px] border transition-all shadow-[0_8px_18px_-8px_rgba(1,35,88,.6)] hover:-translate-y-px ${
        isHistory ? 'bg-tn-teal border-tn-teal text-white' : 'bg-tn-primary border-tn-primary text-white'
      }`}
    >
      {isHistory ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></svg>
      )}
      <span className="text-[#ffffff]">{isHistory ? 'Back to settings' : 'Full history'}</span>
    </button>
  )
}
