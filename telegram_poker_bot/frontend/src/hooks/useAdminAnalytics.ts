import { useState, useCallback } from 'react'
import type {
  RealtimeAnalyticsResponse,
  HourlyAggregatesResponse,
  HistoricalRangeResponse,
  AnalyticsSummaryResponse,
  InsightsResponse,
} from '@/types'
import * as adminAnalyticsAPI from '@/services/adminAnalytics'

export interface AdminAnalyticsState {
  realtime: RealtimeAnalyticsResponse | null
  hourly: HourlyAggregatesResponse | null
  historical: HistoricalRangeResponse | null
  summary: AnalyticsSummaryResponse | null
  insights: InsightsResponse | null
  isLoading: boolean
  error: string | null
}

/**
 * Hook for managing admin analytics data
 * 
 * Provides state management and fetching methods for admin analytics.
 * Caches results to avoid unnecessary API calls.
 */
export function useAdminAnalytics(initData?: string | null) {
  const [state, setState] = useState<AdminAnalyticsState>({
    realtime: null,
    hourly: null,
    historical: null,
    summary: null,
    insights: null,
    isLoading: false,
    error: null,
  })

  const fetchRealtime = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const data = await adminAnalyticsAPI.fetchRealtimeAnalytics({ initData })
      setState(prev => ({ ...prev, realtime: data, isLoading: false }))
      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch realtime analytics'
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }))
      throw error
    }
  }, [initData])

  const fetchHourly = useCallback(async (hours?: number, tableId?: number) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const data = await adminAnalyticsAPI.fetchHourlyAggregates({
        hours,
        table_id: tableId,
        initData,
      })
      setState(prev => ({ ...prev, hourly: data, isLoading: false }))
      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch hourly analytics'
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }))
      throw error
    }
  }, [initData])

  const fetchHistorical = useCallback(
    async (
      startDate: string,
      endDate: string,
      metricType?: 'hourly' | 'snapshot',
      tableId?: number
    ) => {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      try {
        const data = await adminAnalyticsAPI.fetchHistoricalRange({
          start_date: startDate,
          end_date: endDate,
          metric_type: metricType,
          table_id: tableId,
          initData,
        })
        setState(prev => ({ ...prev, historical: data, isLoading: false }))
        return data
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch historical analytics'
        setState(prev => ({ ...prev, error: errorMessage, isLoading: false }))
        throw error
      }
    },
    [initData]
  )

  const fetchSummary = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const data = await adminAnalyticsAPI.fetchAnalyticsSummary(initData)
      setState(prev => ({ ...prev, summary: data, isLoading: false }))
      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch analytics summary'
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }))
      throw error
    }
  }, [initData])

  const fetchInsights = useCallback(async (hours?: number) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const data = await adminAnalyticsAPI.generateInsights({
        hours,
        initData,
      })
      setState(prev => ({ ...prev, insights: data, isLoading: false }))
      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch insights'
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }))
      throw error
    }
  }, [initData])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  const clearData = useCallback(() => {
    setState({
      realtime: null,
      hourly: null,
      historical: null,
      summary: null,
      insights: null,
      isLoading: false,
      error: null,
    })
  }, [])

  return {
    ...state,
    fetchRealtime,
    fetchHourly,
    fetchHistorical,
    fetchSummary,
    fetchInsights,
    clearError,
    clearData,
  }
}
