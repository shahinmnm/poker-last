import { useEffect, useState } from 'react'
import { useTelegram } from '@/hooks/useTelegram'
import { useAdminAnalytics } from '@/hooks/useAdminAnalytics'

/**
 * AdminAnalytics Page Component
 * 
 * Displays realtime, hourly, and summary analytics.
 * Structure and data wiring only - no UI design.
 */
export default function AdminAnalytics() {
  const { initData } = useTelegram()
  const {
    realtime,
    hourly,
    summary,
    isLoading,
    error,
    fetchRealtime,
    fetchHourly,
    fetchSummary,
  } = useAdminAnalytics(initData)

  const [selectedHours, setSelectedHours] = useState(24)

  useEffect(() => {
    fetchRealtime()
    fetchHourly(selectedHours)
    fetchSummary()
  }, [fetchRealtime, fetchHourly, fetchSummary, selectedHours])

  const handleRefresh = () => {
    fetchRealtime()
    fetchHourly(selectedHours)
    fetchSummary()
  }

  if (isLoading && !realtime && !hourly && !summary) {
    return <div>Loading analytics...</div>
  }

  if (error) {
    return (
      <div>
        <p>Error: {error}</p>
        <button onClick={handleRefresh}>Retry</button>
      </div>
    )
  }

  return (
    <div>
      <header>
        <h1>Admin Analytics</h1>
        <button onClick={handleRefresh} disabled={isLoading}>
          Refresh
        </button>
      </header>

      <section data-section="summary">
        <h2>Summary</h2>
        {summary ? (
          <div>
            <div>Timestamp: {summary.timestamp}</div>
            <div>Total Tables: {summary.tables.total}</div>
            <div>
              Tables by Status:
              <ul>
                {Object.entries(summary.tables.by_status).map(([status, count]) => (
                  <li key={status}>
                    {status}: {count}
                  </li>
                ))}
              </ul>
            </div>
            <div>Total Snapshots: {summary.analytics.total_snapshots}</div>
            <div>Total Hourly Stats: {summary.analytics.total_hourly_stats}</div>
          </div>
        ) : (
          <div>No summary data available</div>
        )}
      </section>

      <section data-section="realtime">
        <h2>Realtime Snapshots</h2>
        {realtime ? (
          <div>
            <div>Last Update: {realtime.timestamp}</div>
            <div>Active Tables: {realtime.count}</div>
            <div>
              {realtime.snapshots.map((snapshot) => (
                <div key={snapshot.table_id} data-table-id={snapshot.table_id}>
                  <span>Table {snapshot.table_id}</span>
                  <span>Players: {snapshot.player_count}</span>
                  <span>Active: {snapshot.is_active ? 'Yes' : 'No'}</span>
                  <span>Time: {snapshot.snapshot_time}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>No realtime data available</div>
        )}
      </section>

      <section data-section="hourly">
        <h2>Hourly Statistics</h2>
        <div>
          <label>
            Time Range:
            <select
              value={selectedHours}
              onChange={(e) => setSelectedHours(Number(e.target.value))}
            >
              <option value={1}>Last 1 hour</option>
              <option value={6}>Last 6 hours</option>
              <option value={24}>Last 24 hours</option>
              <option value={72}>Last 3 days</option>
              <option value={168}>Last 7 days</option>
            </select>
          </label>
        </div>
        {hourly ? (
          <div>
            <div>
              Period: {hourly.period.start} to {hourly.period.end}
            </div>
            <div>Stats Count: {hourly.count}</div>
            <div>
              {hourly.hourly_stats.map((stat, index) => (
                <div key={index} data-table-id={stat.table_id}>
                  <span>Table {stat.table_id}</span>
                  <span>Hour: {stat.hour_start}</span>
                  <span>Avg Players: {stat.avg_players.toFixed(2)}</span>
                  <span>Max Players: {stat.max_players}</span>
                  <span>Total Hands: {stat.total_hands}</span>
                  <span>Activity: {stat.activity_minutes}min</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>No hourly data available</div>
        )}
      </section>
    </div>
  )
}
