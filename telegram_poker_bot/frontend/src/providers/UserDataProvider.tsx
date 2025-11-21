import { createContext, ReactNode, useContext, useCallback, useState, useEffect } from 'react'
import { useTelegram } from '../hooks/useTelegram'
import { apiFetch } from '../utils/apiClient'

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
  balance: number
}

interface UserDataContextValue {
  balance: number | null
  stats: UserStats | null
  loading: boolean
  refetchBalance: () => Promise<void>
  refetchStats: () => Promise<void>
  refetchAll: () => Promise<void>
}

const UserDataContext = createContext<UserDataContextValue>({
  balance: null,
  stats: null,
  loading: false,
  refetchBalance: async () => {},
  refetchStats: async () => {},
  refetchAll: async () => {},
})

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { initData, ready } = useTelegram()
  const [balance, setBalance] = useState<number | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(false)

  const refetchBalance = useCallback(async () => {
    if (!initData) return
    
    try {
      const data = await apiFetch<UserBalance>('/users/me/balance', { initData })
      setBalance(data.balance)
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

  const refetchAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([
      refetchBalance(),
      refetchStats(),
    ])
    setLoading(false)
  }, [refetchBalance, refetchStats])

  useEffect(() => {
    if (ready && initData) {
      refetchAll()
    }
  }, [ready, initData, refetchAll])

  const value: UserDataContextValue = {
    balance,
    stats,
    loading,
    refetchBalance,
    refetchStats,
    refetchAll,
  }

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>
}

export function useUserData() {
  return useContext(UserDataContext)
}
