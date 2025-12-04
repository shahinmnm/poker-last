import { apiFetch, type ApiFetchOptions } from '../utils/apiClient'
import type {
  RealtimeAnalyticsResponse,
  HourlyAggregatesResponse,
  HistoricalRangeResponse,
  AnalyticsSummaryResponse,
  InsightsResponse,
  InsightsDeliveryResponse,
  AdminTableDetail,
} from '@/types'

/**
 * Admin Analytics API Client
 * 
 * Provides methods to fetch analytics data from admin-only endpoints.
 * Note: Requires admin authentication in production.
 */

export interface RealtimeAnalyticsParams {
  initData?: string | null
}

export interface HourlyAggregatesParams {
  hours?: number // Default: 24, Range: 1-168
  table_id?: number
  initData?: string | null
}

export interface HistoricalRangeParams {
  start_date: string // ISO format
  end_date: string // ISO format
  metric_type?: 'hourly' | 'snapshot' // Default: hourly
  table_id?: number
  initData?: string | null
}

export interface InsightsParams {
  hours?: number // Analysis period in hours
  initData?: string | null
}

export interface InsightsDeliveryParams {
  hours?: number
  initData?: string | null
}

/**
 * Fetch realtime analytics snapshot for all tables
 */
export async function fetchRealtimeAnalytics(
  params?: RealtimeAnalyticsParams
): Promise<RealtimeAnalyticsResponse> {
  const options: ApiFetchOptions = {
    method: 'GET',
  }

  if (params?.initData) {
    options.initData = params.initData
  }

  return await apiFetch<RealtimeAnalyticsResponse>(
    '/admin/analytics/realtime',
    options
  )
}

/**
 * Fetch hourly aggregated analytics
 */
export async function fetchHourlyAggregates(
  params?: HourlyAggregatesParams
): Promise<HourlyAggregatesResponse> {
  const queryParams = new URLSearchParams()

  if (params?.hours !== undefined) {
    queryParams.append('hours', params.hours.toString())
  }

  if (params?.table_id !== undefined) {
    queryParams.append('table_id', params.table_id.toString())
  }

  const url = `/admin/analytics/hourly${queryParams.toString() ? `?${queryParams.toString()}` : ''}`

  const options: ApiFetchOptions = {
    method: 'GET',
  }

  if (params?.initData) {
    options.initData = params.initData
  }

  return await apiFetch<HourlyAggregatesResponse>(url, options)
}

/**
 * Fetch historical analytics for a date range
 */
export async function fetchHistoricalRange(
  params: HistoricalRangeParams
): Promise<HistoricalRangeResponse> {
  const queryParams = new URLSearchParams({
    start_date: params.start_date,
    end_date: params.end_date,
  })

  if (params.metric_type) {
    queryParams.append('metric_type', params.metric_type)
  }

  if (params.table_id !== undefined) {
    queryParams.append('table_id', params.table_id.toString())
  }

  const url = `/admin/analytics/historical?${queryParams.toString()}`

  const options: ApiFetchOptions = {
    method: 'GET',
  }

  if (params.initData) {
    options.initData = params.initData
  }

  return await apiFetch<HistoricalRangeResponse>(url, options)
}

/**
 * Fetch analytics summary
 */
export async function fetchAnalyticsSummary(
  initData?: string | null
): Promise<AnalyticsSummaryResponse> {
  const options: ApiFetchOptions = {
    method: 'GET',
  }

  if (initData) {
    options.initData = initData
  }

  return await apiFetch<AnalyticsSummaryResponse>(
    '/admin/analytics/summary',
    options
  )
}

/**
 * Generate insights from analytics data
 */
export async function generateInsights(
  params?: InsightsParams
): Promise<InsightsResponse> {
  const queryParams = new URLSearchParams()

  if (params?.hours !== undefined) {
    queryParams.append('hours', params.hours.toString())
  }

  const url = `/admin/insights/generate${queryParams.toString() ? `?${queryParams.toString()}` : ''}`

  const options: ApiFetchOptions = {
    method: 'GET',
  }

  if (params?.initData) {
    options.initData = params.initData
  }

  return await apiFetch<InsightsResponse>(url, options)
}

/**
 * Generate and deliver insights
 */
export async function deliverInsights(
  params?: InsightsDeliveryParams
): Promise<InsightsDeliveryResponse> {
  const queryParams = new URLSearchParams()

  if (params?.hours !== undefined) {
    queryParams.append('hours', params.hours.toString())
  }

  const url = `/admin/insights/deliver${queryParams.toString() ? `?${queryParams.toString()}` : ''}`

  const options: ApiFetchOptions = {
    method: 'POST',
  }

  if (params?.initData) {
    options.initData = params.initData
  }

  return await apiFetch<InsightsDeliveryResponse>(url, options)
}

/**
 * Fetch admin table detail
 * 
 * Note: This endpoint is not yet implemented in the backend.
 * This function is a placeholder for future implementation.
 * 
 * @throws {Error} Will throw an error indicating the endpoint is not implemented
 */
export async function fetchAdminTableDetail(
  tableId: number,
  initData?: string | null
): Promise<AdminTableDetail> {
  // Suppress unused parameter warning - kept for future implementation
  void initData
  
  // Endpoint not yet implemented - throw error to prevent silent failures
  throw new Error(
    `Admin table detail endpoint not yet implemented in backend. ` +
    `Attempted to fetch table ${tableId}. ` +
    `Backend needs to implement: GET /admin/tables/:id`
  )
  
  // Future implementation when backend is ready:
  // const options: ApiFetchOptions = {
  //   method: 'GET',
  // }
  // if (_initData) {
  //   options.initData = _initData
  // }
  // return await apiFetch<AdminTableDetail>(
  //   `/admin/tables/${tableId}`,
  //   options
  // )
}
