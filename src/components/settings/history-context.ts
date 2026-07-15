'use client'

/**
 * Settings "Full history" toggle — lets the change-history view be opened from
 * inside a section's content (the Clients & budgets action row) and closed from
 * the history view, while SettingsNav (client) still owns the actual state.
 * The provider lives in SettingsNav; FullHistoryButton consumes it.
 */

import { createContext, useContext } from 'react'

export const HistoryContext = createContext<{ isHistory: boolean; toggle: () => void }>({
  isHistory: false,
  toggle: () => {},
})

export const useHistory = () => useContext(HistoryContext)
