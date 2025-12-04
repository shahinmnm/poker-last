import { useEffect, useState } from 'react'
import { useTelegram } from '@/hooks/useTelegram'
import { useAdminAnalytics } from '@/hooks/useAdminAnalytics'
import type { Insight, InsightSeverity, InsightType } from '@/types'

/**
 * AdminInsights Page Component
 * 
 * Displays insights feed with filtering and analysis.
 * Structure and data wiring only - no UI design.
 */
export default function AdminInsights() {
  const { initData } = useTelegram()
  const { insights, isLoading, error, fetchInsights } = useAdminAnalytics(initData)

  const [analysisHours, setAnalysisHours] = useState(6)
  const [severityFilter, setSeverityFilter] = useState<InsightSeverity | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<InsightType | 'all'>('all')

  useEffect(() => {
    fetchInsights(analysisHours)
  }, [fetchInsights, analysisHours])

  const filteredInsights = insights?.insights.filter((insight: Insight) => {
    const severityMatch = severityFilter === 'all' || insight.severity === severityFilter
    const typeMatch = typeFilter === 'all' || insight.type === typeFilter
    return severityMatch && typeMatch
  }) || []

  const handleRefresh = () => {
    fetchInsights(analysisHours)
  }

  if (isLoading && !insights) {
    return <div>Loading insights...</div>
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
        <h1>Admin Insights Feed</h1>
        <button onClick={handleRefresh} disabled={isLoading}>
          Refresh
        </button>
      </header>

      <section data-section="controls">
        <div>
          <label>
            Analysis Period:
            <select
              value={analysisHours}
              onChange={(e) => setAnalysisHours(Number(e.target.value))}
            >
              <option value={1}>Last 1 hour</option>
              <option value={6}>Last 6 hours</option>
              <option value={12}>Last 12 hours</option>
              <option value={24}>Last 24 hours</option>
            </select>
          </label>
        </div>

        <div>
          <label>
            Severity Filter:
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as InsightSeverity | 'all')}
            >
              <option value="all">All</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </label>
        </div>

        <div>
          <label>
            Type Filter:
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as InsightType | 'all')}
            >
              <option value="all">All</option>
              <option value="unusual_activity">Unusual Activity</option>
              <option value="high_traffic">High Traffic</option>
              <option value="low_traffic">Low Traffic</option>
              <option value="waitlist_surge">Waitlist Surge</option>
              <option value="inactivity_pattern">Inactivity Pattern</option>
              <option value="rapid_player_change">Rapid Player Change</option>
            </select>
          </label>
        </div>
      </section>

      {insights && (
        <section data-section="summary">
          <h2>Summary</h2>
          <div>Timestamp: {insights.timestamp}</div>
          <div>Analysis Period: {insights.analysis_period_hours} hours</div>
          <div>Total Insights: {insights.count}</div>
          
          <div>
            <h3>By Severity</h3>
            <ul>
              <li>Info: {insights.by_severity.info}</li>
              <li>Warning: {insights.by_severity.warning}</li>
              <li>Critical: {insights.by_severity.critical}</li>
            </ul>
          </div>

          <div>
            <h3>By Type</h3>
            <ul>
              <li>Unusual Activity: {insights.by_type.unusual_activity}</li>
              <li>High Traffic: {insights.by_type.high_traffic}</li>
              <li>Low Traffic: {insights.by_type.low_traffic}</li>
              <li>Waitlist Surge: {insights.by_type.waitlist_surge}</li>
              <li>Inactivity Pattern: {insights.by_type.inactivity_pattern}</li>
              <li>Rapid Player Change: {insights.by_type.rapid_player_change}</li>
            </ul>
          </div>
        </section>
      )}

      <section data-section="insights-list">
        <h2>Insights ({filteredInsights.length})</h2>
        {filteredInsights.length > 0 ? (
          <div>
            {filteredInsights.map((insight: Insight, index: number) => (
              <div
                key={index}
                data-insight-type={insight.type}
                data-insight-severity={insight.severity}
                data-table-id={insight.table_id}
              >
                <div>
                  <span data-label="severity">{insight.severity.toUpperCase()}</span>
                  <span data-label="type">{insight.type}</span>
                  {insight.table_id && <span data-label="table">Table {insight.table_id}</span>}
                </div>
                <div>
                  <strong>{insight.title}</strong>
                </div>
                <div>{insight.message}</div>
                <div>
                  <small>{insight.timestamp}</small>
                </div>
                {insight.metadata && Object.keys(insight.metadata).length > 0 && (
                  <details>
                    <summary>Metadata</summary>
                    <pre>{JSON.stringify(insight.metadata, null, 2)}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div>No insights found matching the selected filters</div>
        )}
      </section>
    </div>
  )
}
