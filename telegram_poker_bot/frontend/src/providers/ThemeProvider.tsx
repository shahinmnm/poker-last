import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'

import { useTelegram } from '../hooks/useTelegram'

type ThemeMode = 'light' | 'dark'

interface ThemeContextValue {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  toggleMode: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  setMode: () => {},
  toggleMode: () => {},
})

const STORAGE_KEY = 'pokerbot.theme'

function applyThemeClass(mode: ThemeMode) {
  if (typeof document === 'undefined') {
    return
  }
  const root = document.documentElement
  if (mode === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  if (document.body) {
    document.body.style.backgroundColor = mode === 'dark' ? '#121212' : '#FFFFFF'
    document.body.style.color = mode === 'dark' ? '#E0E0E0' : '#333333'
  }
}

function loadStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') {
    return null
  }
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'dark' || stored === 'light' ? (stored as ThemeMode) : null
}

function detectSystemTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light'
  }
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { colorScheme } = useTelegram()
  const [mode, setModeState] = useState<ThemeMode>(() => loadStoredTheme() ?? detectSystemTheme())

  useEffect(() => {
    if (!colorScheme) {
      return
    }
    setModeState((current) => (current === colorScheme ? current : colorScheme))
  }, [colorScheme])

  useEffect(() => {
    applyThemeClass(mode)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, mode)
    }
  }, [mode])

  useEffect(() => {
    applyThemeClass(mode)
  }, [])

  const setMode = (next: ThemeMode) => {
    setModeState(next)
  }

  const toggleMode = () => {
    setModeState((current) => (current === 'light' ? 'dark' : 'light'))
  }

  const value = useMemo(
    () => ({
      mode,
      setMode,
      toggleMode,
    }),
    [mode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
