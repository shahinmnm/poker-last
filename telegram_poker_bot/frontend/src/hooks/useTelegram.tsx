import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'

type ThemeMode = 'light' | 'dark'

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

interface TelegramContextType {
  user: TelegramUser | null
  initData: string | null
  ready: boolean
  colorScheme: ThemeMode
  startParam: string | null
}

const TelegramContext = createContext<TelegramContextType>({
  user: null,
  initData: null,
  ready: false,
  colorScheme: 'light',
  startParam: null,
})

function detectPreferredScheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light'
  }

  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }

  return 'light'
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [initData, setInitData] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [colorScheme, setColorScheme] = useState<ThemeMode>(detectPreferredScheme)
  const [startParam, setStartParam] = useState<string | null>(null)

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg) {
      setReady(true)
      return
    }

    tg.ready()
    tg.expand()

    setUser(tg.initDataUnsafe?.user || null)
    setInitData(tg.initData || null)
    setStartParam(tg.initDataUnsafe?.start_param || null)
    setColorScheme(tg.colorScheme === 'dark' ? 'dark' : 'light')
    setReady(true)

    const handleThemeChange = () => {
      setColorScheme(tg.colorScheme === 'dark' ? 'dark' : 'light')
    }

    tg.onEvent?.('themeChanged', handleThemeChange)

    return () => {
      tg.offEvent?.('themeChanged', handleThemeChange)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      initData,
      ready,
      colorScheme,
      startParam,
    }),
    [user, initData, ready, colorScheme, startParam],
  )

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>
}

export function useTelegram() {
  return useContext(TelegramContext)
}

// TypeScript declaration for Telegram WebApp
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void
        expand: () => void
        initData: string
        initDataUnsafe: {
          user?: TelegramUser
          start_param?: string
        }
        colorScheme?: ThemeMode
        onEvent?: (event: 'themeChanged', handler: () => void) => void
        offEvent?: (event: 'themeChanged', handler: () => void) => void
      }
    }
  }
}
