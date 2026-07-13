'use client'

/**
 * Settings edit mode — a page-level view/edit toggle (the "Edit" button on the
 * Settings surface). Editors read `useEditing()` to gate their edit affordances
 * (e.g. the token fields only show Change/Remove while editing). Works across
 * the server/client boundary: SettingsNav (client) provides it, and the
 * server-rendered section content mounts client editors that consume it.
 */

import { createContext, useContext } from 'react'

export const EditingContext = createContext(false)

export const useEditing = () => useContext(EditingContext)
