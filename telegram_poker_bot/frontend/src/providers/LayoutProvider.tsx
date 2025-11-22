/**
 * LayoutContext - Controls visibility of app-level UI elements
 * 
 * Used to hide/show the bottom navigation and header when entering immersive views
 * like the poker table game controls.
 */

import { createContext, useContext, useState, ReactNode } from 'react'

interface LayoutContextValue {
  /** Whether to show the bottom navigation */
  showBottomNav: boolean
  /** Set bottom navigation visibility */
  setShowBottomNav: (show: boolean) => void
}

const LayoutContext = createContext<LayoutContextValue | undefined>(undefined)

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [showBottomNav, setShowBottomNav] = useState(true)

  return (
    <LayoutContext.Provider value={{ showBottomNav, setShowBottomNav }}>
      {children}
    </LayoutContext.Provider>
  )
}

export function useLayout() {
  const context = useContext(LayoutContext)
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider')
  }
  return context
}
