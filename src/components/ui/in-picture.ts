'use client'

/**
 * True inside a System manual picture (owner, 4 November 2026: the guides show
 * the real screens with made-up data). A window, drawer or phone sheet there
 * draws in place, over the picture's own box (its nearest positioned parent),
 * instead of over the whole page, and leaves the keyboard, the focus and the
 * page's scrolling alone. Everywhere else it is false and nothing changes.
 */

import { createContext, useContext } from 'react'

export const InPicture = createContext(false)

export const useInPicture = (): boolean => useContext(InPicture)
