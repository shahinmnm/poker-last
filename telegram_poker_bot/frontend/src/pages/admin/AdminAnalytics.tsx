import { useEffect, useState } from 'react'
import { useTelegram } from '@/hooks/useTelegram'
import { useAdminAnalytics } from '@/hooks/useAdminAnalytics'
import { adminGetDashboardKPIs, AdminDashboardKPIs, adminListTables, AdminTableSummary } from '../../utils/apiClient'

/**
 * AdminAnalytics Page Component
 * 
 * Displays KPI dashboard with key metrics, charts, and stuck tables.
 */
export default function AdminAnalytics() {
  const { initData } = useTelegram()
  const {
    realtime,
    hourly,
    isLoading,
    error: analyticsError,
    fetchRealtime,
    fetchHourly,
    fetchSummary,
  } = useAdminAnalytics(initData)

  const [kpis, setKpis] = useState<AdminDashboardKPIs['kpis'] | null>(null)
  const [stuckTables, setStuckTables] = useState<AdminTableSummary[]>([])
  const [kpisError, setKpisError] = useState<string | null>(null)
  const [selectedHours, setSelectedHours] = useState(24)

  useEffect(() => {
    fetchRealtime()
    fetchHourly(selectedHours)
    fetchSummary()
  }, [fetchRealtime, fetchHourly, fetchSummary, selectedHours])

  // Fetch KPIs
  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        const response = await adminGetDashboardKPIs()
        setKpis(response.kpis)
      } catch (err) {
        setKpisError(err instanceof Error ? err.message : 'Failed to fetch KPIs')
      }
    }

    fetchKPIs()
    const interval = setInterval(fetchKPIs, 30000)
    return () => clearInterval(interval)
  }, [])

  // Fetch stuck tables
  useEffect(() => {
    const fetchStuckTables = async () => {
      try {
        const response = await adminListTables({ stuck_only: true, limit: 10 })
        setStuckTables(response.tables)
      } catch {
        // Ignore errors
      }
    }

    fetchStuckTables()
    const interval = setInterval(fetchStuckTables, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    fetchRealtime()
    fetchHourly(selectedHours)
    fetchSummary()
  }

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const error = analyticsError || kpisError

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorBox}>
          <p style={styles.errorText}>Error: {error}</p>
          <button onClick={handleRefresh} style={styles.retryButton}>Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* KPI Cards */}
      <div style={styles.kpiGrid}>
        <KPICard
          label="Total Users"
          value={kpis?.total_users?.toLocaleString() ?? '-'}
          icon="👥"
        />
        <KPICard
          label="Active Tables"
          value={kpis?.active_tables?.toString() ?? '-'}
          icon="🎰"
        />
        <KPICard
          label="Hands (24h)"
          value={kpis?.hands_24h?.toLocaleString() ?? '-'}
          icon="🃏"
        />
        <KPICard
          label="Active Players (24h)"
          value={kpis?.active_players_24h?.toLocaleString() ?? '-'}
          icon="🎮"
        />
        <KPICard
          label="Deposits (24h)"
          value={kpis ? formatCurrency(kpis.deposits_24h) : '-'}
          icon="💰"
          color="#22c55e"
        />
        <KPICard
          label="Withdrawals (24h)"
          value={kpis ? formatCurrency(kpis.withdrawals_24h) : '-'}
          icon="💸"
          color="#ef4444"
        />
        <KPICard
          label="Net Flow (24h)"
          value={kpis ? formatCurrency(kpis.net_flow_24h) : '-'}
          icon="📊"
          color={kpis && kpis.net_flow_24h >= 0 ? '#22c55e' : '#ef4444'}
        />
        <KPICard
          label="Stuck Tables"
          value={kpis?.stuck_tables?.toString() ?? '-'}
          icon="⚠️"
          color={kpis && kpis.stuck_tables > 0 ? '#f59e0b' : '#22c55e'}
        />
      </div>

      {/* Stuck Tables Alert */}
      {stuckTables.length > 0 && (
        <div style={styles.alertSection}>
          <h3 style={styles.sectionTitle}>⚠️ Stuck Tables</h3>
          <div style={styles.stuckTablesList}>
            {stuckTables.map((table) => (
              <div key={table.table_id} style={styles.stuckTableCard}>
                <div style={styles.stuckTableHeader}>
                  <span style={styles.stuckTableId}>Table #{table.table_id}</span>
                  <span style={styles.stuckTableStatus}>{table.status}</span>
                </div>
                <div style={styles.stuckTableInfo}>
                  <span>Type: {table.template_type || 'Unknown'}</span>
                  <span>Seats: {table.seated_count}</span>
                  <span>Last Activity: {table.last_action_at ? new Date(table.last_action_at).toLocaleString() : 'N/A'}</span>
                </div>
                <a href={`/admin/tables`} style={styles.viewLink}>View Details →</a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tables by Status */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>📊 Tables by Status</h3>
        <div style={styles.statusGrid}>
          {kpis?.tables_by_status && Object.entries(kpis.tables_by_status).map(([status, count]) => (
            <div key={status} style={styles.statusCard}>
              <span style={styles.statusLabel}>{status}</span>
              <span style={styles.statusValue}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Analytics Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>📈 Live Analytics</h3>
          <div style={styles.sectionActions}>
            <select
              value={selectedHours}
              onChange={(e) => setSelectedHours(Number(e.target.value))}
              style={styles.select}
            >
              <option value={1}>Last 1 hour</option>
              <option value={6}>Last 6 hours</option>
              <option value={24}>Last 24 hours</option>
              <option value={72}>Last 3 days</option>
              <option value={168}>Last 7 days</option>
            </select>
            <button onClick={handleRefresh} disabled={isLoading} style={styles.refreshButton}>
              🔄 {isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Realtime Snapshots */}
        <div style={styles.analyticsGrid}>
          <div style={styles.analyticsCard}>
            <h4 style={styles.cardTitle}>Active Table Snapshots</h4>
            {realtime && realtime.snapshots.length > 0 ? (
              <div style={styles.snapshotsList}>
                {realtime.snapshots.slice(0, 10).map((snapshot) => (
                  <div key={snapshot.table_id} style={styles.snapshotItem}>
                    <span style={styles.snapshotTableId}>Table #{snapshot.table_id}</span>
                    <span style={styles.snapshotPlayers}>{snapshot.player_count} players</span>
                    <span style={snapshot.is_active ? styles.statusActive : styles.statusInactive}>
                      {snapshot.is_active ? '● Active' : '○ Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.noData}>No active table snapshots</div>
            )}
          </div>

          {/* Hourly Stats Summary */}
          <div style={styles.analyticsCard}>
            <h4 style={styles.cardTitle}>Hourly Stats Summary</h4>
            {hourly && hourly.hourly_stats.length > 0 ? (
              <div style={styles.statsSummary}>
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>Total Entries</span>
                  <span style={styles.statValue}>{hourly.count}</span>
                </div>
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>Period</span>
                  <span style={styles.statValue}>{selectedHours}h</span>
                </div>
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>Avg Players</span>
                  <span style={styles.statValue}>
                    {hourly.hourly_stats.length > 0
                      ? (hourly.hourly_stats.reduce((sum, s) => sum + s.avg_players, 0) / hourly.hourly_stats.length).toFixed(1)
                      : '-'}
                  </span>
                </div>
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>Total Hands</span>
                  <span style={styles.statValue}>
                    {hourly.hourly_stats.reduce((sum, s) => sum + s.total_hands, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <div style={styles.noData}>No hourly stats available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// KPI Card Component
function KPICard({ label, value, icon, color }: { label: string; value: string; icon: string; color?: string }) {
  return (
    <div style={styles.kpiCard}>
      <div style={styles.kpiIcon}>{icon}</div>
      <div style={styles.kpiContent}>
        <span style={styles.kpiLabel}>{label}</span>
        <span style={{ ...styles.kpiValue, color: color || '#f8fafc' }}>{value}</span>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '0',
  },
  errorContainer: {
    padding: '48px',
    display: 'flex',
    justifyContent: 'center',
  },
  errorBox: {
    backgroundColor: '#7f1d1d',
    color: '#fecaca',
    padding: '24px',
    borderRadius: '12px',
    textAlign: 'center',
  },
  errorText: {
    margin: '0 0 16px 0',
  },
  retryButton: {
    padding: '10px 20px',
    backgroundColor: '#334155',
    border: 'none',
    borderRadius: '8px',
    color: '#f8fafc',
    cursor: 'pointer',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  kpiCard: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  kpiIcon: {
    fontSize: '32px',
  },
  kpiContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  kpiLabel: {
    fontSize: '13px',
    color: '#94a3b8',
    marginBottom: '4px',
  },
  kpiValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  alertSection: {
    backgroundColor: '#7f1d1d',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
    border: '1px solid #dc2626',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    margin: '0 0 16px 0',
    color: '#f8fafc',
  },
  stuckTablesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  stuckTableCard: {
    backgroundColor: '#991b1b',
    borderRadius: '8px',
    padding: '14px',
  },
  stuckTableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  stuckTableId: {
    fontWeight: '600',
    color: '#fecaca',
  },
  stuckTableStatus: {
    fontSize: '12px',
    color: '#f87171',
    textTransform: 'uppercase',
  },
  stuckTableInfo: {
    display: 'flex',
    gap: '16px',
    fontSize: '13px',
    color: '#fca5a5',
    marginBottom: '8px',
  },
  viewLink: {
    fontSize: '13px',
    color: '#fcd34d',
    textDecoration: 'none',
  },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
    border: '1px solid #334155',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  sectionActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  select: {
    padding: '8px 12px',
    backgroundColor: '#334155',
    border: '1px solid #475569',
    borderRadius: '6px',
    color: '#f8fafc',
    fontSize: '13px',
  },
  refreshButton: {
    padding: '8px 16px',
    backgroundColor: '#334155',
    border: 'none',
    borderRadius: '6px',
    color: '#f8fafc',
    fontSize: '13px',
    cursor: 'pointer',
  },
  statusGrid: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  statusCard: {
    backgroundColor: '#334155',
    borderRadius: '8px',
    padding: '12px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '100px',
  },
  statusLabel: {
    fontSize: '12px',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  statusValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  analyticsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  analyticsCard: {
    backgroundColor: '#334155',
    borderRadius: '8px',
    padding: '16px',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#94a3b8',
    margin: '0 0 12px 0',
  },
  snapshotsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  snapshotItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#1e293b',
    borderRadius: '6px',
    fontSize: '13px',
  },
  snapshotTableId: {
    fontWeight: '500',
    color: '#f8fafc',
  },
  snapshotPlayers: {
    color: '#94a3b8',
  },
  statusActive: {
    color: '#22c55e',
    fontSize: '12px',
  },
  statusInactive: {
    color: '#64748b',
    fontSize: '12px',
  },
  statsSummary: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    padding: '12px',
    backgroundColor: '#1e293b',
    borderRadius: '6px',
  },
  statLabel: {
    fontSize: '12px',
    color: '#94a3b8',
    marginBottom: '4px',
  },
  statValue: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  noData: {
    padding: '24px',
    textAlign: 'center',
    color: '#64748b',
    fontSize: '14px',
  },
}
