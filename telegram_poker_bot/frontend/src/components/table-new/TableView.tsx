/**
 * Phase 5: TableView Component (NEW)
 * 
 * Main table view that uses normalized state from useTableSync.
 * Strictly backend-driven. No client-side logic.
 */

import { useParams } from 'react-router-dom'
import { useCallback } from 'react'
import { useTableSync } from '../../hooks/useTableSync'
import ActionPanel from './ActionPanel'
import Seat from './Seat'
import CommunityBoard from './CommunityBoard'
import DrawRenderer from './DrawRenderer'
import type { ActionType, CardCode } from '../../types/normalized'
import { apiFetch } from '@/utils/apiClient'

export function TableView() {
  const { tableId } = useParams<{ tableId: string }>()

  // Handle schema version mismatch with hard reload
  const handleSchemaVersionMismatch = useCallback(() => {
    console.error('[TableView] Schema version mismatch detected - reloading page')
    window.location.reload()
  }, [])

  const {
    state,
    connectionState,
    isLive,
    requestSnapshot,
    lastUpdate,
  } = useTableSync({
    tableId: Number(tableId),
    enabled: true,
    onSchemaVersionMismatch: handleSchemaVersionMismatch,
  })

  // Handle player action
  const handleAction = useCallback(async (action: ActionType, amount?: number) => {
    if (!tableId) return

    try {
      const payload: any = { action_type: action }
      
      if (amount !== undefined && (action === 'bet' || action === 'raise')) {
        payload.amount = amount
      }

      await apiFetch(`/tables/${tableId}/actions`, {
        method: 'POST',
        body: payload,
      })

      console.log('[TableView] Action sent:', action, amount)
    } catch (error) {
      console.error('[TableView] Failed to send action:', error)
    }
  }, [tableId])

  // Handle discard action (draw games)
  const handleDiscard = useCallback(async (cards: CardCode[]) => {
    if (!tableId) return

    try {
      await apiFetch(`/tables/${tableId}/actions`, {
        method: 'POST',
        body: {
          action_type: 'discard',
          cards_to_discard: cards,
        },
      })

      console.log('[TableView] Discard sent:', cards)
    } catch (error) {
      console.error('[TableView] Failed to send discard:', error)
    }
  }, [tableId])

  // Handle stand pat action
  const handleStandPat = useCallback(async () => {
    if (!tableId) return

    try {
      await apiFetch(`/tables/${tableId}/actions`, {
        method: 'POST',
        body: {
          action_type: 'stand_pat',
        },
      })

      console.log('[TableView] Stand pat sent')
    } catch (error) {
      console.error('[TableView] Failed to send stand pat:', error)
    }
  }, [tableId])

  // Loading state
  if (!state) {
    return (
      <div className="table-view-loading flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-xl font-semibold text-white mb-2">
            {connectionState === 'connecting' && 'Connecting to table...'}
            {connectionState === 'syncing_snapshot' && 'Loading table state...'}
            {connectionState === 'disconnected' && 'Disconnected'}
            {connectionState === 'version_mismatch' && 'Version mismatch - reloading...'}
          </div>
          {connectionState === 'disconnected' && (
            <button
              onClick={requestSnapshot}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Reconnect
            </button>
          )}
        </div>
      </div>
    )
  }

  const {
    seat_map,
    legal_actions,
    action_deadline,
    community_cards,
    current_street,
    table_metadata,
    discard_phase_active,
    discard_limits,
  } = state

  // Find current user's seat (this would come from auth context in real implementation)
  const currentUserSeat = seat_map.find((seat) => seat.is_acting) // Placeholder logic

  return (
    <div className="table-view relative h-screen bg-gradient-to-br from-gray-900 to-gray-800 overflow-hidden">
      {/* Connection status indicator */}
      <div className="absolute top-4 right-4 z-10">
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
          isLive ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'
        }`}>
          {connectionState}
        </div>
      </div>

      {/* Table metadata */}
      <div className="absolute top-4 left-4 z-10">
        <div className="bg-gray-800 rounded-lg px-4 py-2 text-white">
          <div className="font-bold">{table_metadata.name}</div>
          <div className="text-sm text-gray-400">
            {table_metadata.variant} • {table_metadata.stakes}
          </div>
        </div>
      </div>

      {/* Main table area */}
      <div className="table-container relative h-full flex flex-col items-center justify-center p-8">
        {/* Community cards */}
        <div className="community-board-container mb-8">
          <CommunityBoard
            communityCards={community_cards}
            street={current_street}
          />
        </div>

        {/* Seats arranged in circle */}
        <div className="seats-container relative w-full max-w-4xl h-96">
          {seat_map.map((seat) => {
            // Calculate position in circle (simple layout for now)
            const angle = (seat.seat_index / seat_map.length) * 2 * Math.PI
            const radius = 180
            const x = Math.cos(angle) * radius
            const y = Math.sin(angle) * radius

            return (
              <div
                key={seat.seat_index}
                className="absolute"
                style={{
                  left: `calc(50% + ${x}px)`,
                  top: `calc(50% + ${y}px)`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <Seat
                  seat={seat}
                  actionDeadline={seat.is_acting ? action_deadline : null}
                  currency={table_metadata.currency as any}
                />
              </div>
            )
          })}
        </div>

        {/* Action panel at bottom */}
        {legal_actions.length > 0 && (
          <div className="action-panel-container fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4">
            <ActionPanel
              legalActions={legal_actions}
              onAction={handleAction}
              currency={table_metadata.currency as any}
            />
          </div>
        )}

        {/* Draw phase UI (overlays action panel when active) */}
        {discard_phase_active && currentUserSeat && (
          <div className="draw-phase-container fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4">
            <DrawRenderer
              holeCards={currentUserSeat.hole_cards}
              discardPhaseActive={discard_phase_active}
              discardLimits={discard_limits}
              onDiscard={handleDiscard}
              onStandPat={handleStandPat}
            />
          </div>
        )}
      </div>

      {/* Debug info (development only) */}
      {import.meta.env.DEV && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white text-xs p-2 rounded max-w-xs">
          <div>Street: {current_street || 'N/A'}</div>
          <div>Actions: {legal_actions.length}</div>
          <div>Last update: {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : 'N/A'}</div>
        </div>
      )}
    </div>
  )
}

export default TableView
