/**
 * AdminTables Page Component - Ops Dashboard
 * 
 * Provides operator-grade table management:
 * - Table list with filters and stuck detection
 * - Table detail view with full diagnostics
 * - Action buttons for fixing stuck tables
 * - System toggles for emergency operations
 */
import { useState, useEffect, useCallback } from 'react'
import {
  AdminTableSummary,
  AdminTableDetailResponse,
  AdminSystemToggles,
  adminListTables,
  adminGetTable,
  adminResetStuckHand,
  adminForceWaiting,
  adminKickAll,
  adminClearRuntimeCache,
  adminBroadcastSnapshot,
  adminGetSystemToggles,
  adminSetSystemToggles,
} from '@/utils/apiClient'

// Styles
const styles = {
  container: {
    display: 'flex',
    gap: '16px',
    padding: '16px',
    minHeight: 'calc(100vh - 60px)',
  },
  leftPanel: {
    flex: '0 0 400px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  rightPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  card: {
    background: '#1e1e1e',
    borderRadius: '8px',
    padding: '16px',
    border: '1px solid #333',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #444',
    background: '#2a2a2a',
    color: '#fff',
    fontSize: '14px',
  },
  select: {
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid #444',
    background: '#2a2a2a',
    color: '#fff',
    fontSize: '13px',
  },
  tableList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    maxHeight: '400px',
    overflowY: 'auto' as const,
  },
  tableRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: '6px',
    background: '#252525',
    cursor: 'pointer',
    gap: '12px',
  },
  tableRowSelected: {
    background: '#1a4d2e',
    border: '1px solid #2d8a52',
  },
  tableRowStuck: {
    borderLeft: '3px solid #ff4444',
  },
  badge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
  },
  badgeActive: {
    background: '#2d8a52',
    color: '#fff',
  },
  badgeWaiting: {
    background: '#666',
    color: '#fff',
  },
  badgeStuck: {
    background: '#ff4444',
    color: '#fff',
  },
  button: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'background 0.2s',
  },
  buttonPrimary: {
    background: '#2d8a52',
    color: '#fff',
  },
  buttonDanger: {
    background: '#cc3333',
    color: '#fff',
  },
  buttonSecondary: {
    background: '#444',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  detailSection: {
    marginBottom: '16px',
  },
  detailLabel: {
    color: '#888',
    fontSize: '12px',
    marginBottom: '4px',
  },
  detailValue: {
    color: '#fff',
    fontSize: '14px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
  },
  toast: {
    position: 'fixed' as const,
    bottom: '20px',
    right: '20px',
    padding: '12px 20px',
    borderRadius: '8px',
    color: '#fff',
    zIndex: 1000,
    maxWidth: '400px',
  },
  toastSuccess: {
    background: '#2d8a52',
  },
  toastError: {
    background: '#cc3333',
  },
  modal: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    background: '#1e1e1e',
    borderRadius: '12px',
    padding: '24px',
    maxWidth: '500px',
    width: '90%',
  },
  checkbox: {
    marginRight: '8px',
  },
  toggleContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid #333',
  },
  toggle: {
    position: 'relative' as const,
    width: '50px',
    height: '26px',
    background: '#444',
    borderRadius: '13px',
    cursor: 'pointer',
  },
  toggleActive: {
    background: '#cc3333',
  },
  toggleHandle: {
    position: 'absolute' as const,
    top: '3px',
    left: '3px',
    width: '20px',
    height: '20px',
    background: '#fff',
    borderRadius: '50%',
    transition: 'left 0.2s',
  },
  toggleHandleActive: {
    left: '27px',
  },
}

interface Toast {
  message: string
  type: 'success' | 'error'
}

interface ConfirmModal {
  title: string
  message: string
  confirmText: string
  onConfirm: () => void
  requireTableIdConfirm?: number
}

export default function AdminTables() {
  // State
  const [tables, setTables] = useState<AdminTableSummary[]>([])
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null)
  const [tableDetail, setTableDetail] = useState<AdminTableDetailResponse | null>(null)
  const [systemToggles, setSystemToggles] = useState<AdminSystemToggles | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null)
  const [confirmInput, setConfirmInput] = useState('')
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [isPublicFilter, setIsPublicFilter] = useState<string>('')
  const [stuckOnly, setStuckOnly] = useState(false)
  const [searchId, setSearchId] = useState('')
  
  // Reset options
  const [resetKickPlayers, setResetKickPlayers] = useState(false)
  const [resetClearCache, setResetClearCache] = useState(true)
  const [kickMode, setKickMode] = useState<'after_hand' | 'immediate_abort_then_kick'>('after_hand')

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }, [])

  // Load tables
  const loadTables = useCallback(async () => {
    setLoading(true)
    try {
      const response = await adminListTables({
        status: statusFilter || undefined,
        is_public: isPublicFilter === '' ? undefined : isPublicFilter === 'true',
        stuck_only: stuckOnly,
        limit: 200,
      })
      let filtered = response.tables
      if (searchId) {
        const searchNum = parseInt(searchId, 10)
        if (!isNaN(searchNum)) {
          filtered = filtered.filter(t => t.table_id === searchNum)
        }
      }
      setTables(filtered)
    } catch (err) {
      showToast(`Failed to load tables: ${err}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, isPublicFilter, stuckOnly, searchId, showToast])

  // Load table detail
  const loadTableDetail = useCallback(async (tableId: number) => {
    try {
      const detail = await adminGetTable(tableId)
      setTableDetail(detail)
    } catch (err) {
      showToast(`Failed to load table detail: ${err}`, 'error')
    }
  }, [showToast])

  // Load system toggles
  const loadSystemToggles = useCallback(async () => {
    try {
      const toggles = await adminGetSystemToggles()
      setSystemToggles(toggles)
    } catch (err) {
      showToast(`Failed to load system toggles: ${err}`, 'error')
    }
  }, [showToast])

  // Initial load
  useEffect(() => {
    loadTables()
    loadSystemToggles()
  }, [loadTables, loadSystemToggles])

  // Auto-refresh selected table
  useEffect(() => {
    if (selectedTableId) {
      loadTableDetail(selectedTableId)
    }
  }, [selectedTableId, loadTableDetail])

  // Select table
  const handleSelectTable = (tableId: number) => {
    setSelectedTableId(tableId)
  }

  // Action handlers
  const handleRefresh = async () => {
    await loadTables()
    if (selectedTableId) {
      await loadTableDetail(selectedTableId)
    }
    showToast('Refreshed', 'success')
  }

  const handleBroadcastSnapshot = async () => {
    if (!selectedTableId) return
    setActionLoading(true)
    try {
      await adminBroadcastSnapshot(selectedTableId)
      showToast('Snapshot broadcasted', 'success')
    } catch (err) {
      showToast(`Failed: ${err}`, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleForceWaiting = async () => {
    if (!selectedTableId) return
    setActionLoading(true)
    try {
      await adminForceWaiting(selectedTableId)
      showToast(`Table ${selectedTableId} set to WAITING`, 'success')
      await loadTables()
      await loadTableDetail(selectedTableId)
    } catch (err) {
      showToast(`Failed: ${err}`, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleResetStuckHand = async () => {
    if (!selectedTableId) return
    setConfirmModal(null)
    setConfirmInput('')
    setActionLoading(true)
    try {
      const result = await adminResetStuckHand(selectedTableId, {
        kick_players: resetKickPlayers,
        clear_runtime_cache: resetClearCache,
        reason: 'Admin reset via Ops Dashboard',
      })
      showToast(`Reset completed: ${result.actions_taken.length} actions`, 'success')
      await loadTables()
      await loadTableDetail(selectedTableId)
    } catch (err) {
      showToast(`Failed: ${err}`, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleKickAll = async () => {
    if (!selectedTableId) return
    setConfirmModal(null)
    setConfirmInput('')
    setActionLoading(true)
    try {
      await adminKickAll(selectedTableId, { mode: kickMode })
      showToast(`Kicked all players from table ${selectedTableId}`, 'success')
      await loadTables()
      await loadTableDetail(selectedTableId)
    } catch (err) {
      showToast(`Failed: ${err}`, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleClearCache = async () => {
    if (!selectedTableId) return
    setConfirmModal(null)
    setConfirmInput('')
    setActionLoading(true)
    try {
      await adminClearRuntimeCache(selectedTableId)
      showToast(`Cache cleared for table ${selectedTableId}`, 'success')
      await loadTableDetail(selectedTableId)
    } catch (err) {
      showToast(`Failed: ${err}`, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleChange = async (toggle: 'pause_autostart' | 'pause_interhand_monitor') => {
    if (!systemToggles) return
    try {
      const newValue = !systemToggles.toggles[toggle]
      const result = await adminSetSystemToggles({ [toggle]: newValue })
      setSystemToggles(result)
      showToast(`${toggle} set to ${newValue}`, 'success')
    } catch (err) {
      showToast(`Failed: ${err}`, 'error')
    }
  }

  const copyDiagnostics = () => {
    if (tableDetail) {
      navigator.clipboard.writeText(JSON.stringify(tableDetail, null, 2))
      showToast('Diagnostics copied to clipboard', 'success')
    }
  }

  const getStatusBadgeStyle = (status: string | null, isStuck: boolean) => {
    if (isStuck) return { ...styles.badge, ...styles.badgeStuck }
    if (status === 'active') return { ...styles.badge, ...styles.badgeActive }
    return { ...styles.badge, ...styles.badgeWaiting }
  }

  return (
    <div style={styles.container}>
      {/* Left Panel - Table List */}
      <div style={styles.leftPanel}>
        {/* Filters */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Filters</h3>
            <button
              style={{ ...styles.button, ...styles.buttonSecondary }}
              onClick={handleRefresh}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              type="text"
              placeholder="Search by Table ID..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              style={styles.input}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ ...styles.select, flex: 1 }}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="waiting">Waiting</option>
                <option value="paused">Paused</option>
                <option value="ended">Ended</option>
                <option value="expired">Expired</option>
              </select>
              <select
                value={isPublicFilter}
                onChange={(e) => setIsPublicFilter(e.target.value)}
                style={{ ...styles.select, flex: 1 }}
              >
                <option value="">Public/Private</option>
                <option value="true">Public Only</option>
                <option value="false">Private Only</option>
              </select>
            </div>
            <label style={{ color: '#888', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={stuckOnly}
                onChange={(e) => setStuckOnly(e.target.checked)}
                style={styles.checkbox}
              />
              Show Stuck Only
            </label>
          </div>
        </div>

        {/* Table List */}
        <div style={{ ...styles.card, flex: 1 }}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Tables ({tables.length})</h3>
          </div>
          <div style={styles.tableList}>
            {tables.map((table) => (
              <div
                key={table.table_id}
                style={{
                  ...styles.tableRow,
                  ...(selectedTableId === table.table_id ? styles.tableRowSelected : {}),
                  ...(table.is_stuck ? styles.tableRowStuck : {}),
                }}
                onClick={() => handleSelectTable(table.table_id)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#fff' }}>Table {table.table_id}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    {table.template_type || 'Unknown'} • {table.active_count}/{table.seated_count} players
                  </div>
                </div>
                <span style={getStatusBadgeStyle(table.status, table.is_stuck)}>
                  {table.is_stuck ? 'STUCK' : (table.status || 'unknown').toUpperCase()}
                </span>
              </div>
            ))}
            {tables.length === 0 && (
              <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
                No tables found
              </div>
            )}
          </div>
        </div>

        {/* System Toggles */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>🚨 System Toggles</h3>
          </div>
          {systemToggles && (
            <>
              <div style={styles.toggleContainer}>
                <div>
                  <div style={{ color: '#fff', fontSize: '14px' }}>Pause Autostart</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>Stops automatic table starts</div>
                </div>
                <div
                  style={{
                    ...styles.toggle,
                    ...(systemToggles.toggles.pause_autostart ? styles.toggleActive : {}),
                  }}
                  onClick={() => handleToggleChange('pause_autostart')}
                >
                  <div
                    style={{
                      ...styles.toggleHandle,
                      ...(systemToggles.toggles.pause_autostart ? styles.toggleHandleActive : {}),
                    }}
                  />
                </div>
              </div>
              <div style={{ ...styles.toggleContainer, borderBottom: 'none' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: '14px' }}>Pause Inter-Hand Monitor</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>Stops automatic hand advancement</div>
                </div>
                <div
                  style={{
                    ...styles.toggle,
                    ...(systemToggles.toggles.pause_interhand_monitor ? styles.toggleActive : {}),
                  }}
                  onClick={() => handleToggleChange('pause_interhand_monitor')}
                >
                  <div
                    style={{
                      ...styles.toggleHandle,
                      ...(systemToggles.toggles.pause_interhand_monitor ? styles.toggleHandleActive : {}),
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Panel - Table Detail */}
      <div style={styles.rightPanel}>
        {selectedTableId && tableDetail ? (
          <>
            {/* Table Summary */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>Table {selectedTableId} - Details</h3>
                <button
                  style={{ ...styles.button, ...styles.buttonSecondary }}
                  onClick={copyDiagnostics}
                >
                  📋 Copy Diagnostics
                </button>
              </div>
              <div style={styles.grid}>
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Status</div>
                  <div style={styles.detailValue}>
                    <span style={getStatusBadgeStyle(tableDetail.table.status, tableDetail.diagnostics.is_stuck)}>
                      {tableDetail.diagnostics.is_stuck ? 'STUCK' : (tableDetail.table.status || 'unknown').toUpperCase()}
                    </span>
                  </div>
                </div>
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Template</div>
                  <div style={styles.detailValue}>{tableDetail.template?.name || 'N/A'}</div>
                </div>
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Is Public</div>
                  <div style={styles.detailValue}>{tableDetail.table.is_public ? 'Yes' : 'No'}</div>
                </div>
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Lobby Persistent</div>
                  <div style={styles.detailValue}>{tableDetail.table.lobby_persistent ? 'Yes' : 'No'}</div>
                </div>
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Created</div>
                  <div style={styles.detailValue}>
                    {tableDetail.table.created_at ? new Date(tableDetail.table.created_at).toLocaleString() : 'N/A'}
                  </div>
                </div>
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Last Activity</div>
                  <div style={styles.detailValue}>
                    {tableDetail.table.last_action_at ? new Date(tableDetail.table.last_action_at).toLocaleString() : 'N/A'}
                  </div>
                </div>
              </div>
              {tableDetail.diagnostics.stuck_reason && (
                <div style={{ background: '#442222', padding: '10px', borderRadius: '6px', marginTop: '12px' }}>
                  <div style={{ color: '#ff6666', fontWeight: 600, fontSize: '13px' }}>⚠️ Stuck Reason</div>
                  <div style={{ color: '#ffaaaa', fontSize: '13px' }}>{tableDetail.diagnostics.stuck_reason}</div>
                </div>
              )}
            </div>

            {/* Hand Info */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>Current Hand</h3>
              </div>
              {tableDetail.current_hand ? (
                <div style={styles.grid}>
                  <div style={styles.detailSection}>
                    <div style={styles.detailLabel}>Hand ID</div>
                    <div style={styles.detailValue}>{tableDetail.current_hand.id}</div>
                  </div>
                  <div style={styles.detailSection}>
                    <div style={styles.detailLabel}>Hand #</div>
                    <div style={styles.detailValue}>{tableDetail.current_hand.hand_no}</div>
                  </div>
                  <div style={styles.detailSection}>
                    <div style={styles.detailLabel}>Status</div>
                    <div style={styles.detailValue}>{tableDetail.current_hand.status}</div>
                  </div>
                  <div style={styles.detailSection}>
                    <div style={styles.detailLabel}>Pot Size</div>
                    <div style={styles.detailValue}>{tableDetail.current_hand.pot_size}</div>
                  </div>
                </div>
              ) : (
                <div style={{ color: '#888' }}>No active hand</div>
              )}
            </div>

            {/* Seats */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>
                  Seats ({tableDetail.seat_summary.active} active / {tableDetail.seat_summary.seated} seated)
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                {tableDetail.seats.filter(s => !s.left_at).map((seat) => (
                  <div key={seat.seat_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', background: '#252525', borderRadius: '4px' }}>
                    <div style={{ width: '24px', color: '#888' }}>#{seat.position}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#fff', fontSize: '13px' }}>{seat.username || `User ${seat.user_id}`}</div>
                      <div style={{ color: '#888', fontSize: '11px' }}>Chips: {seat.chips}</div>
                    </div>
                    {seat.is_sitting_out_next_hand && (
                      <span style={{ ...styles.badge, background: '#666' }}>SITTING OUT</span>
                    )}
                  </div>
                ))}
                {tableDetail.seats.filter(s => !s.left_at).length === 0 && (
                  <div style={{ color: '#888' }}>No seated players</div>
                )}
              </div>
            </div>

            {/* Runtime & Cache Info */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>Runtime State</h3>
              </div>
              <div style={styles.grid}>
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Current Actor</div>
                  <div style={styles.detailValue}>{String(tableDetail.runtime.current_actor ?? 'N/A')}</div>
                </div>
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Street</div>
                  <div style={styles.detailValue}>{String(tableDetail.runtime.street ?? 'N/A')}</div>
                </div>
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>To Call</div>
                  <div style={styles.detailValue}>{String(tableDetail.runtime.to_call ?? 'N/A')}</div>
                </div>
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Redis Lock</div>
                  <div style={styles.detailValue}>
                    {tableDetail.cache.lock_key_exists ? '🔒 Locked' : '🔓 Free'}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>Actions</h3>
              </div>
              
              {/* Safe Actions */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>✅ Safe Actions</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    style={{ ...styles.button, ...styles.buttonSecondary, ...(actionLoading ? styles.buttonDisabled : {}) }}
                    onClick={() => loadTableDetail(selectedTableId)}
                    disabled={actionLoading}
                  >
                    🔄 Refresh
                  </button>
                  <button
                    style={{ ...styles.button, ...styles.buttonPrimary, ...(actionLoading ? styles.buttonDisabled : {}) }}
                    onClick={handleBroadcastSnapshot}
                    disabled={actionLoading}
                  >
                    📡 Broadcast Snapshot
                  </button>
                  <button
                    style={{ ...styles.button, ...styles.buttonSecondary, ...(actionLoading ? styles.buttonDisabled : {}) }}
                    onClick={handleForceWaiting}
                    disabled={actionLoading}
                  >
                    ⏸️ Force Waiting
                  </button>
                </div>
              </div>

              {/* Dangerous Actions */}
              <div>
                <div style={{ color: '#ff6666', fontSize: '12px', marginBottom: '8px' }}>⚠️ Dangerous Actions (Require Confirmation)</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    style={{ ...styles.button, ...styles.buttonDanger, ...(actionLoading ? styles.buttonDisabled : {}) }}
                    onClick={() => setConfirmModal({
                      title: 'Reset Stuck Hand',
                      message: `This will abort any active hand on Table ${selectedTableId} and set it to WAITING.`,
                      confirmText: 'Reset Hand',
                      onConfirm: handleResetStuckHand,
                      requireTableIdConfirm: selectedTableId,
                    })}
                    disabled={actionLoading}
                  >
                    🔧 Reset Stuck Hand
                  </button>
                  <button
                    style={{ ...styles.button, ...styles.buttonDanger, ...(actionLoading ? styles.buttonDisabled : {}) }}
                    onClick={() => setConfirmModal({
                      title: 'Kick All Players',
                      message: `This will remove all players from Table ${selectedTableId}.`,
                      confirmText: 'Kick All',
                      onConfirm: handleKickAll,
                      requireTableIdConfirm: selectedTableId,
                    })}
                    disabled={actionLoading}
                  >
                    🚪 Kick All
                  </button>
                  <button
                    style={{ ...styles.button, ...styles.buttonDanger, ...(actionLoading ? styles.buttonDisabled : {}) }}
                    onClick={() => setConfirmModal({
                      title: 'Clear Runtime Cache',
                      message: `This will clear Redis cache for Table ${selectedTableId}.`,
                      confirmText: 'Clear Cache',
                      onConfirm: handleClearCache,
                      requireTableIdConfirm: selectedTableId,
                    })}
                    disabled={actionLoading}
                  >
                    🗑️ Clear Cache
                  </button>
                </div>

                {/* Reset options */}
                <div style={{ marginTop: '12px', padding: '10px', background: '#252525', borderRadius: '6px' }}>
                  <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>Reset Options:</div>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '13px', marginBottom: '6px' }}>
                    <input
                      type="checkbox"
                      checked={resetKickPlayers}
                      onChange={(e) => setResetKickPlayers(e.target.checked)}
                      style={styles.checkbox}
                    />
                    Kick players after reset
                  </label>
                  <label style={{ display: 'block', color: '#ccc', fontSize: '13px', marginBottom: '6px' }}>
                    <input
                      type="checkbox"
                      checked={resetClearCache}
                      onChange={(e) => setResetClearCache(e.target.checked)}
                      style={styles.checkbox}
                    />
                    Clear runtime cache
                  </label>
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ color: '#888', fontSize: '12px' }}>Kick Mode:</label>
                    <select
                      value={kickMode}
                      onChange={(e) => setKickMode(e.target.value as 'after_hand' | 'immediate_abort_then_kick')}
                      style={{ ...styles.select, marginLeft: '8px' }}
                    >
                      <option value="after_hand">After Hand (Safe)</option>
                      <option value="immediate_abort_then_kick">Abort Then Kick</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ ...styles.card, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#888', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
              <div>Select a table from the list to view details</div>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ ...styles.toast, ...(toast.type === 'success' ? styles.toastSuccess : styles.toastError) }}>
          {toast.message}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div style={styles.modal} onClick={() => { setConfirmModal(null); setConfirmInput('') }}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#fff', marginTop: 0 }}>{confirmModal.title}</h3>
            <p style={{ color: '#ccc' }}>{confirmModal.message}</p>
            {confirmModal.requireTableIdConfirm && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#888', fontSize: '13px' }}>
                  Type table ID ({confirmModal.requireTableIdConfirm}) to confirm:
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  style={{ ...styles.input, marginTop: '8px' }}
                  placeholder={`Enter ${confirmModal.requireTableIdConfirm}`}
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                style={{ ...styles.button, ...styles.buttonSecondary }}
                onClick={() => { setConfirmModal(null); setConfirmInput('') }}
              >
                Cancel
              </button>
              <button
                style={{
                  ...styles.button,
                  ...styles.buttonDanger,
                  ...(confirmModal.requireTableIdConfirm && confirmInput !== String(confirmModal.requireTableIdConfirm) ? styles.buttonDisabled : {}),
                }}
                onClick={confirmModal.onConfirm}
                disabled={confirmModal.requireTableIdConfirm ? confirmInput !== String(confirmModal.requireTableIdConfirm) : false}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
