/**
 * Phase 5: TableView Component (NEW)
 * 
 * Main table view that uses normalized state from useTableSync.
 * Strictly backend-driven. No client-side logic.
 */

import { useParams, useNavigate } from 'react-router-dom'
import { useCallback, useMemo, useState } from 'react'
import { useTableSync } from '../../hooks/useTableSync'
import { useTableAnimations } from '../../hooks/useTableAnimations'
import { useTelegram } from '../../hooks/useTelegram'
import { Loader2 } from 'lucide-react'
import ActionPanel from './ActionPanel'
import Seat from './Seat'
import CommunityBoard from './CommunityBoard'
import DrawRenderer from './DrawRenderer'
import PotDisplay from './PotDisplay'
import HandResultOverlay from './HandResultOverlay'
import WinnerBanner from './WinnerBanner'
import Modal from '../ui/Modal'
import ConnectionStatus from '../ui/ConnectionStatus'
import { getSeatLayout } from '../../config/tableLayout'
import type { ActionType, CardCode, TableDeltaMessage } from '../../types/normalized'
import { apiFetch } from '@/utils/apiClient'

export function TableView() {
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()
  const { user, initData } = useTelegram()
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [buyInAmount, setBuyInAmount] = useState<number | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [showHandResult, setShowHandResult] = useState(false)
  const [showWinnerBanner, setShowWinnerBanner] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  // Handle schema version mismatch with hard reload
  const handleSchemaVersionMismatch = useCallback(() => {
    console.error('[TableView] Schema version mismatch detected - reloading page')
    window.location.reload()
  }, [])

  // Initialize animation hook
  const { potRef, onDelta: animationOnDelta } = useTableAnimations({ 
    audioEnabled: false // Can be toggled via settings
  })

  const {
    state,
    connectionState,
    requestSnapshot,
    lastUpdate,
  } = useTableSync({
    tableId: Number(tableId),
    enabled: true,
    onSchemaVersionMismatch: handleSchemaVersionMismatch,
    onDelta: useCallback((delta: TableDeltaMessage) => {
      // Trigger animations based on delta type
      animationOnDelta(delta)
      
      // Check if hand_result exists in payload
      if (delta.payload.hand_result) {
        setShowWinnerBanner(true)
        setShowHandResult(true)
      }
    }, [animationOnDelta]),
  })

  // Handle player action - now with JWT
  const handleAction = useCallback(async (action: ActionType, amount?: number) => {
    if (!tableId || !initData) return

    try {
      const payload: { action_type: ActionType; amount?: number } = { action_type: action }
      
      if (amount !== undefined && (action === 'bet' || action === 'raise')) {
        payload.amount = amount
      }

      await apiFetch(`/tables/${tableId}/actions`, {
        method: 'POST',
        body: payload,
        initData, // Attach Telegram initData (JWT)
      })

      console.log('[TableView] Action sent:', action, amount)
    } catch (error) {
      console.error('[TableView] Failed to send action:', error)
    }
  }, [tableId, initData])

  // Handle discard action (draw games) - now with JWT
  const handleDiscard = useCallback(async (cards: CardCode[]) => {
    if (!tableId || !initData) return

    try {
      await apiFetch(`/tables/${tableId}/actions`, {
        method: 'POST',
        body: {
          action_type: 'discard',
          cards_to_discard: cards,
        },
        initData, // Attach Telegram initData (JWT)
      })

      console.log('[TableView] Discard sent:', cards)
    } catch (error) {
      console.error('[TableView] Failed to send discard:', error)
    }
  }, [tableId, initData])

  // Handle stand pat action - now with JWT
  const handleStandPat = useCallback(async () => {
    if (!tableId || !initData) return

    try {
      await apiFetch(`/tables/${tableId}/actions`, {
        method: 'POST',
        body: {
          action_type: 'stand_pat',
        },
        initData, // Attach Telegram initData (JWT)
      })

      console.log('[TableView] Stand pat sent')
    } catch (error) {
      console.error('[TableView] Failed to send stand pat:', error)
    }
  }, [tableId, initData])

  // Handle join table
  const handleJoin = useCallback(async () => {
    if (!tableId || !initData || !state) return

    try {
      setIsJoining(true)
      
      // Check if buy-in is required
      if (state.table_metadata.buyin_limits) {
        // Show buy-in modal
        setBuyInAmount(state.table_metadata.buyin_limits.min)
        setShowJoinModal(true)
      } else {
        // Join directly
        await apiFetch(`/tables/${tableId}/join`, {
          method: 'POST',
          initData,
        })
        
        console.log('[TableView] Joined table')
        requestSnapshot() // Refresh state
      }
    } catch (error) {
      console.error('[TableView] Failed to join table:', error)
    } finally {
      setIsJoining(false)
    }
  }, [tableId, initData, state, requestSnapshot])

  // Handle buy-in and join
  const handleBuyIn = useCallback(async () => {
    if (!tableId || !initData || buyInAmount === null) return

    try {
      setIsJoining(true)
      
      // First join the table
      await apiFetch(`/tables/${tableId}/join`, {
        method: 'POST',
        initData,
      })

      // Then buy-in
      await apiFetch(`/tables/${tableId}/buy-in`, {
        method: 'POST',
        body: { amount: buyInAmount },
        initData,
      })

      console.log('[TableView] Joined and bought in for:', buyInAmount)
      setShowJoinModal(false)
      requestSnapshot() // Refresh state
    } catch (error) {
      console.error('[TableView] Failed to buy-in:', error)
    } finally {
      setIsJoining(false)
    }
  }, [tableId, initData, buyInAmount, requestSnapshot])

  // Handle leave seat
  const handleLeave = useCallback(async () => {
    if (!tableId || !initData) return

    try {
      await apiFetch(`/tables/${tableId}/leave-seat`, {
        method: 'POST',
        initData,
      })

      console.log('[TableView] Left seat')
      
      // Close modal and redirect to lobby on success
      setShowLeaveConfirm(false)
      navigate('/lobby')
    } catch (error) {
      console.error('[TableView] Failed to leave seat:', error)
      setShowLeaveConfirm(false)
    }
  }, [tableId, initData, navigate])

  // Hero detection: Find current user's seat by matching user_id
  const heroUserId = user?.id
  const heroSeat = useMemo(() => {
    if (!state || !heroUserId) return null
    return state.seat_map.find((seat) => seat.user_id === heroUserId) || null
  }, [state, heroUserId])

  // Calculate seat positions using elliptical layout with hero-centering
  const seatPositions = useMemo(() => {
    if (!state) return []
    
    const totalSeats = state.seat_map.length
    const layoutSlots = getSeatLayout(totalSeats)
    
    // Find hero's seat index for rotation
    const heroSeatIndex = heroSeat?.seat_index ?? null
    
    return state.seat_map.map((seat) => {
      // Calculate visual index (rotate so hero is at position 0, which is bottom center)
      let visualIndex = seat.seat_index
      if (heroSeatIndex !== null) {
        visualIndex = (seat.seat_index - heroSeatIndex + totalSeats) % totalSeats
      }
      
      // Get layout position from config
      const layoutSlot = layoutSlots[visualIndex] || layoutSlots[0]
      
      return {
        seat,
        xPercent: layoutSlot.xPercent,
        yPercent: layoutSlot.yPercent,
        isHero: seat.seat_index === heroSeatIndex,
      }
    })
  }, [state, heroSeat])

  // Handle sit out toggle
  const handleSitOut = useCallback(async (sitOut: boolean) => {
    if (!tableId || !initData || !heroSeat) return

    try {
      await apiFetch(`/tables/${tableId}/sitout`, {
        method: 'POST',
        body: { sit_out: sitOut },
        initData,
      })

      console.log('[TableView] Toggled sit out:', sitOut)
      // State will be updated via WebSocket
    } catch (error) {
      console.error('[TableView] Failed to toggle sit out:', error)
    }
  }, [tableId, initData, heroSeat])

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
    pots,
  } = state
  
  const heroSeatId = heroSeat?.seat_index ?? null
  const isHeroActing = state.acting_seat_id === heroSeatId

  return (
    <div className="table-view relative h-screen bg-gradient-to-br from-gray-900 to-gray-800 overflow-hidden">
      {/* Resync overlay - blocking UI during snapshot sync */}
      {connectionState === 'syncing_snapshot' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30 transition-opacity duration-300">
          <div className="bg-black/40 backdrop-blur-md rounded-2xl px-8 py-6 flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-amber-400 animate-spin" />
            <div className="text-white text-lg font-semibold">Syncing Table State...</div>
            <div className="text-gray-400 text-sm">Please wait while we sync the latest data</div>
          </div>
        </div>
      )}

      {/* Table metadata and connection status - Z-Index: 50 */}
      <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
        <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg px-4 py-2 text-white">
          <div className="font-bold">{table_metadata.name}</div>
          <div className="text-sm text-gray-400">
            {table_metadata.variant} • {table_metadata.stakes}
          </div>
        </div>
        <ConnectionStatus connectionState={connectionState} />
      </div>

      {/* Leave Table button in top-right corner (for seated players only) - Z-Index: 50 */}
      {heroSeat && (
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold flex items-center gap-2"
            title="Leave table and cash out"
          >
            <span>Leave Table</span>
          </button>
        </div>
      )}

      {/* Main table area with strict Z-Index layering */}
      <div className="table-container relative h-full flex flex-col items-center justify-center">
        {/* Pot display - Z-Index: 10 */}
        <div ref={potRef} className="pot-display-container absolute top-[35%] left-1/2 -translate-x-1/2 z-10">
          <PotDisplay pots={pots} currency={table_metadata.currency as 'REAL' | 'PLAY'} />
        </div>

        {/* Community cards - Z-Index: 20 */}
        <div className="community-board-container absolute top-[45%] left-1/2 -translate-x-1/2 z-20">
          <CommunityBoard
            communityCards={community_cards}
            street={current_street}
          />
        </div>

        {/* Seats arranged in ellipse with safe zone - Z-Index: 30 */}
        <div className="seats-container absolute inset-0 pb-48 z-30">
          {seatPositions.map(({ seat, xPercent, yPercent, isHero }) => {
            return (
              <div
                key={seat.seat_index}
                className="absolute"
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <Seat
                  seat={seat}
                  actionDeadline={seat.is_acting ? action_deadline : null}
                  currency={table_metadata.currency as 'REAL' | 'PLAY'}
                  isHero={isHero}
                  isActing={seat.is_acting && isHero && isHeroActing}
                />
              </div>
            )
          })}
        </div>

        {/* Action panel at bottom - Z-Index: 50 (Fixed Bottom) */}
        {heroSeat && (
          <div className="action-panel-container fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50">
            <ActionPanel
              legalActions={isHeroActing ? legal_actions : []}
              onAction={handleAction}
              currency={table_metadata.currency as 'REAL' | 'PLAY'}
              disabled={!isHeroActing}
              isSittingOut={heroSeat.is_sitting_out}
              onSitOutToggle={handleSitOut}
              showSitOutToggle={true}
            />
          </div>
        )}

        {/* Join button for spectators - Z-Index: 50 */}
        {!heroSeat && (
          <div className="join-button-container fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50">
            <button
              onClick={handleJoin}
              disabled={isJoining}
              className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJoining ? 'Joining...' : 'Join Table'}
            </button>
          </div>
        )}

        {/* Draw phase UI (overlays action panel when active) - Z-Index: 50 */}
        {discard_phase_active && heroSeat && (
          <div className="draw-phase-container fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50">
            <DrawRenderer
              holeCards={heroSeat.hole_cards}
              discardPhaseActive={discard_phase_active}
              discardLimits={discard_limits}
              onDiscard={handleDiscard}
              onStandPat={handleStandPat}
            />
          </div>
        )}
      </div>

      {/* Buy-in modal */}
      {showJoinModal && table_metadata.buyin_limits && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-white mb-4">Buy-in Required</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Amount ({table_metadata.currency})
              </label>
              <input
                type="number"
                min={table_metadata.buyin_limits.min}
                max={table_metadata.buyin_limits.max}
                value={buyInAmount ?? table_metadata.buyin_limits.min}
                onChange={(e) => setBuyInAmount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg"
              />
              <div className="text-xs text-gray-400 mt-1">
                Min: {table_metadata.buyin_limits.min} | Max: {table_metadata.buyin_limits.max}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowJoinModal(false)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleBuyIn}
                disabled={isJoining}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
              >
                {isJoining ? 'Joining...' : 'Join'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug info (development only) */}
      {import.meta.env.DEV && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white text-xs p-2 rounded max-w-xs">
          <div>Street: {current_street || 'N/A'}</div>
          <div>Actions: {legal_actions.length}</div>
          <div>Last update: {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : 'N/A'}</div>
        </div>
      )}

      {/* Winner banner */}
      {showWinnerBanner && state.hand_result && (
        <WinnerBanner
          winners={state.hand_result.winners}
          currency={table_metadata.currency as 'REAL' | 'PLAY'}
          onComplete={() => setShowWinnerBanner(false)}
        />
      )}

      {/* Hand result overlay */}
      {showHandResult && state.hand_result && (
        <HandResultOverlay
          handResult={state.hand_result}
          currency={table_metadata.currency as 'REAL' | 'PLAY'}
          onClose={() => setShowHandResult(false)}
        />
      )}

      {/* Leave table confirmation modal */}
      <Modal
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        title="Leave Table?"
        description="Are you sure you want to leave the table and cash out?"
        confirmLabel="Leave Table"
        cancelLabel="Stay"
        confirmVariant="danger"
        onConfirm={handleLeave}
      />
    </div>
  )
}

export default TableView
