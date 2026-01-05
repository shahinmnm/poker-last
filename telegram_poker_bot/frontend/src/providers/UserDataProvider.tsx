import { createContext, ReactNode, useContext, useCallback, useState, useEffect, useRef } from 'react'
import { useTelegram } from '../hooks/useTelegram'
import { apiFetch } from '../utils/apiClient'
import type { CurrencyType } from '../utils/currency'

interface UserStats {
  hands_played: number
  tables_played: number
  total_profit: number
  biggest_pot: number
  win_rate: number
  current_streak: number
  first_game_date?: string | null
}

interface UserBalance {
  balance_real: number
  balance_play: number
}

interface UserPreferences {
  preferred_currency?: CurrencyType
}

interface UserDataContextValue {
  balance: number | null
  balances: UserBalance | null
  balanceReal: number | null
  balancePlay: number | null
  preferredCurrency: CurrencyType
  stats: UserStats | null
  loading: boolean
  refetchPreferences: () => Promise<void>
  refetchBalance: () => Promise<void>
  refetchStats: () => Promise<void>
  refetchAll: () => Promise<void>
  setPreferredCurrency: (currency: CurrencyType) => Promise<void>
}

const UserDataContext = createContext<UserDataContextValue>({
  balance: null,
  balances: null,
  balanceReal: null,
  balancePlay: null,
  preferredCurrency: 'REAL',
  stats: null,
  loading: false,
  refetchPreferences: async () => {},
  refetchBalance: async () => {},
  refetchStats: async () => {},
  refetchAll: async () => {},
  setPreferredCurrency: async () => {},
})

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { initData, ready } = useTelegram()
  const [balances, setBalances] = useState<UserBalance | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [preferredCurrency, setPreferredCurrencyState] = useState<CurrencyType>('REAL')
  const balanceRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refetchBalance = useCallback(async () => {
    if (!initData) return
    
    try {
      const data = await apiFetch<UserBalance | { balance: number } | number>('/users/me/balance', { initData })
      let balanceReal = 0
      let balancePlay = 0

      if (typeof data === 'number') {
        balanceReal = data
      } else if (data && typeof data === 'object') {
        const maybeBalance = (data as any).balance
        const maybeReal = (data as any).balance_real
        const maybePlay = (data as any).balance_play
        balanceReal = typeof maybeReal === 'number' ? maybeReal : typeof maybeBalance === 'number' ? maybeBalance : 0
        balancePlay = typeof maybePlay === 'number' ? maybePlay : 0
      }

      setBalances({
        balance_real: balanceReal,
        balance_play: balancePlay,
      })
    } catch (err) {
      console.warn('Failed to fetch balance', err)
    }
  }, [initData])

  const refetchStats = useCallback(async () => {
    if (!initData) return
    
    try {
      const data = await apiFetch<UserStats>('/users/me/stats', { initData })
      setStats(data)
    } catch (err) {
      console.warn('Failed to fetch stats', err)
    }
  }, [initData])

  const refetchPreferences = useCallback(async () => {
    if (!initData) return

    try {
      const data = await apiFetch<UserPreferences>('/users/me/preferences', { initData })
      if (data?.preferred_currency === 'REAL' || data?.preferred_currency === 'PLAY') {
        setPreferredCurrencyState(data.preferred_currency)
      }
    } catch (err) {
      console.warn('Failed to fetch user preferences', err)
    }
  }, [initData])

  const setPreferredCurrency = useCallback(async (currency: CurrencyType) => {
    setPreferredCurrencyState(currency)
    if (!initData) return

    try {
      await apiFetch<UserPreferences>('/users/me/preferences', {
        method: 'POST',
        initData,
        body: { preferred_currency: currency },
      })
    } catch (err) {
      console.warn('Failed to update preferred currency', err)
    }
  }, [initData])

  const refetchAll = useCallback(async () => {
    if (!initData) return
    
    setLoading(true)
    try {
      await Promise.all([refetchBalance(), refetchStats(), refetchPreferences()])
    } catch (err) {
      console.warn('Failed to refresh user data', err)
    } finally {
      setLoading(false)
    }
  }, [initData, refetchBalance, refetchPreferences, refetchStats])

  useEffect(() => {
    if (ready && initData) {
      refetchAll()
    }
  }, [ready, initData, refetchAll])

  useEffect(() => {
    if (!ready || !initData) return
    if (balanceRefreshRef.current) {
      clearInterval(balanceRefreshRef.current)
    }
    balanceRefreshRef.current = setInterval(() => {
      refetchBalance()
    }, 30000)
    return () => {
      if (balanceRefreshRef.current) {
        clearInterval(balanceRefreshRef.current)
        balanceRefreshRef.current = null
      }
    }
  }, [initData, ready, refetchBalance])

  const value: UserDataContextValue = {
    balance: balances?.balance_real ?? null,
    balances,
    balanceReal: balances?.balance_real ?? null,
    balancePlay: balances?.balance_play ?? null,
    preferredCurrency,
    stats,
    loading,
    refetchPreferences,
    refetchBalance,
    refetchStats,
    refetchAll,
    setPreferredCurrency,
  }

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>
}

export function useUserData() {
  return useContext(UserDataContext)
}
