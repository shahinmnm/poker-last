import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

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
}

const TelegramContext = createContext<TelegramContextType>({
  user: null,
  initData: null,
  ready: false,
})

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [initData, setInitData] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Initialize Telegram WebApp
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp
      tg.ready()
      tg.expand()

      setUser(tg.initDataUnsafe?.user || null)
      setInitData(tg.initData || null)
      setReady(true)
    } else {
      // Fallback for development
      setReady(true)
    }
  }, [])

  return (
    <TelegramContext.Provider value={{ user, initData, ready }}>
      {children}
    </TelegramContext.Provider>
  )
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
        }
      }
    }
  }
}
