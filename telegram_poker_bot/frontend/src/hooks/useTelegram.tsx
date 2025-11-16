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

const DEV_STORAGE_KEYS = {
  initData: 'pokerbot.dev.telegramInitData',
  user: 'pokerbot.dev.telegramUser',
  startParam: 'pokerbot.dev.telegramStartParam',
  colorScheme: 'pokerbot.dev.telegramColorScheme',
} as const

const allowMock =
  typeof import.meta !== 'undefined' &&
  (import.meta.env.VITE_ENABLE_TELEGRAM_MOCK === 'true' || import.meta.env.DEV)

function safeParseJson<T>(value: string | null | undefined): T | null {
  if (!value) {
    return null
  }
  try {
    return JSON.parse(value) as T
  } catch {
    if (import.meta.env.DEV) {
      console.warn('[useTelegram] Failed to parse mock JSON payload.', value)
    }
    return null
  }
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function normalizeThemeMode(value?: string | null): ThemeMode | null {
  const normalized = value?.toString().toLowerCase()
  if (normalized === 'dark' || normalized === 'light') {
    return normalized
  }
  return null
}

interface MockTelegramContext {
  user: TelegramUser | null
  initData: string | null
  startParam: string | null
  colorScheme: ThemeMode | null
}

function readMockTelegramContext(): MockTelegramContext | null {
  if (!allowMock || typeof window === 'undefined') {
    return null
  }

  const params = new URLSearchParams(window.location.search)
  const storage = getStorage()

  const queryInit =
    params.get('tgWebAppData') ||
    params.get('tg_data') ||
    params.get('initData') ||
    params.get('tgInitData')
  const queryUser = params.get('tgUser')
  const queryStart = params.get('tgStartParam')
  const queryColor = params.get('tgColorScheme') || params.get('tgColor')

  const envInit = (import.meta.env.VITE_TELEGRAM_INIT_DATA as string | undefined) || null
  const envUser = (import.meta.env.VITE_TELEGRAM_USER as string | undefined) || null
  const envStart = (import.meta.env.VITE_TELEGRAM_START_PARAM as string | undefined) || null
  const envColor = (import.meta.env.VITE_TELEGRAM_COLOR_SCHEME as string | undefined) || null

  const storedInit = storage?.getItem(DEV_STORAGE_KEYS.initData) ?? null
  const storedUser = storage?.getItem(DEV_STORAGE_KEYS.user) ?? null
  const storedStart = storage?.getItem(DEV_STORAGE_KEYS.startParam) ?? null
  const storedColor = storage?.getItem(DEV_STORAGE_KEYS.colorScheme) ?? null

  const initData = queryInit || envInit || storedInit
  const userRaw = queryUser || envUser || storedUser
  const startParam = queryStart || envStart || storedStart
  const colorRaw = queryColor || envColor || storedColor

  if (!initData && !userRaw && !startParam) {
    return null
  }

  try {
    if (storage) {
      if (initData) {
        storage.setItem(DEV_STORAGE_KEYS.initData, initData)
      }
      if (userRaw) {
        storage.setItem(DEV_STORAGE_KEYS.user, userRaw)
      }
      if (startParam) {
        storage.setItem(DEV_STORAGE_KEYS.startParam, startParam)
      }
      if (colorRaw) {
        storage.setItem(DEV_STORAGE_KEYS.colorScheme, colorRaw)
      }
    }
  } catch {
    // Ignore storage write failures (e.g. private mode).
  }

  const consumedKeys = [
    'tgWebAppData',
    'tg_data',
    'initData',
    'tgInitData',
    'tgUser',
    'tgStartParam',
    'tgColorScheme',
    'tgColor',
  ]
  let shouldCleanSearch = false
  consumedKeys.forEach((key) => {
    if (params.has(key)) {
      params.delete(key)
      shouldCleanSearch = true
    }
  })
  if (shouldCleanSearch && window.history?.replaceState) {
    const newSearch = params.toString()
    const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}${window.location.hash}`
    try {
      window.history.replaceState({}, '', newUrl)
    } catch {
      // Ignore history errors (e.g. sandboxed iframes).
    }
  }

  return {
    user: safeParseJson<TelegramUser>(userRaw) ?? null,
    initData: initData || null,
    startParam: startParam || null,
    colorScheme: normalizeThemeMode(colorRaw),
  }
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [initData, setInitData] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [colorScheme, setColorScheme] = useState<ThemeMode>(detectPreferredScheme)
  const [startParam, setStartParam] = useState<string | null>(null)

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    const fallback = readMockTelegramContext()

    if (!tg) {
      if (fallback) {
        setUser(fallback.user)
        setInitData(fallback.initData)
        setStartParam(fallback.startParam)
        setColorScheme(fallback.colorScheme ?? detectPreferredScheme())
      }
      setReady(true)
      return
    }

    tg.ready()
    tg.expand()

    const resolvedUser = tg.initDataUnsafe?.user || fallback?.user || null
    const resolvedInitData = tg.initData || fallback?.initData || null
    const resolvedStart = tg.initDataUnsafe?.start_param || fallback?.startParam || null
    const resolvedScheme =
      tg.colorScheme === 'dark'
        ? 'dark'
        : tg.colorScheme === 'light'
          ? 'light'
          : fallback?.colorScheme ?? detectPreferredScheme()

    setUser(resolvedUser)
    setInitData(resolvedInitData)
    setStartParam(resolvedStart)
    setColorScheme(resolvedScheme)
    setReady(true)

    const handleThemeChange = () => {
      const scheme =
        tg.colorScheme === 'dark'
          ? 'dark'
          : tg.colorScheme === 'light'
            ? 'light'
            : fallback?.colorScheme ?? detectPreferredScheme()
      setColorScheme(scheme)
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
