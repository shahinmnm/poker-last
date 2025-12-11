/**
 * Phase 5: TableView Component (NEW)
 * 
 * Main table view that uses normalized state from useTableSync.
 * Modern minimalist UI with floating glassmorphism elements.
 * The table felt is the hero - elements float over the felt.
 */

import { useParams, useNavigate } from 'react-router-dom'
import { useCallback, useMemo, useState } from 'react'
import { useTableSync } from '../../hooks/useTableSync'
import { useTableAnimations } from '../../hooks/useTableAnimations'
import { useTelegram } from '../../hooks/useTelegram'
import { Loader2, X, LogOut, MoreVertical } from 'lucide-react'
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
  const [showMenu, setShowMenu] = useState(false)

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

  // Handle close table (navigate back)
  const handleClose = useCallback(() => {
    navigate('/lobby')
  }, [navigate])

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
    if (totalSeats === 0) return []
    
    const layoutSlots = getSeatLayout(totalSeats)
    
    // Find hero's seat index for rotation
    const heroSeatIndex = heroSeat?.seat_index ?? null
    
    return state.seat_map.map((seat) => {
      // Calculate visual index (rotate so hero is at position 0, which is bottom center)
      let visualIndex = seat.seat_index
      if (heroSeatIndex !== null) {
        visualIndex = (seat.seat_index - heroSeatIndex + totalSeats) % totalSeats
      }
      
      // Get layout position from config (with bounds checking)
      const layoutSlot = layoutSlots[visualIndex] || layoutSlots[0] || { xPercent: 50, yPercent: 50 }
      
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
      <div className="table-view-loading flex items-center justify-center h-screen bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-400 animate-spin mx-auto mb-4" />
          <div className="text-xl font-semibold text-white mb-2">
            {connectionState === 'connecting' && 'Connecting to table...'}
            {connectionState === 'syncing_snapshot' && 'Loading table state...'}
            {connectionState === 'disconnected' && 'Disconnected'}
            {connectionState === 'version_mismatch' && 'Version mismatch - reloading...'}
          </div>
          {connectionState === 'disconnected' && (
            <button
              onClick={requestSnapshot}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-semibold"
            >
              Reconnect
            </button>
          )}
        </div>
      </div>
    )
  }

  const {
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-sm bg-black/30 transition-opacity duration-300">
          <div className="bg-black/40 backdrop-blur-md rounded-2xl px-8 py-6 flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-amber-400 animate-spin" />
            <div className="text-white text-lg font-semibold">Syncing Table State...</div>
            <div className="text-gray-400 text-sm">Please wait while we sync the latest data</div>
          </div>
        </div>
      )}

      {/* Floating HUD Header - Z-Index: 50 */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-50 pointer-events-none">
        {/* Left Group */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Close Button - glassmorphism circle */}
          <button
            onClick={handleClose}
            className="bg-black/40 hover:bg-black/60 text-white rounded-full p-2 backdrop-blur-md transition-colors"
            title="Back to lobby"
          >
            <X size={18} />
          </button>
          
          {/* Table Info Pill */}
          <div className="bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">
            <span className="text-xs font-medium text-gray-200">
              {table_metadata.stakes}
            </span>
          </div>
          
          {/* Connection Status */}
          <ConnectionStatus connectionState={connectionState} />
        </div>

        {/* Right Group */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Stand Up / Leave Seat Button (for seated players only) */}
          {heroSeat && (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="bg-black/40 hover:bg-black/60 text-white rounded-full p-2 backdrop-blur-md transition-colors"
              title="Leave table"
            >
              <LogOut size={18} />
            </button>
          )}
          
          {/* Menu Button */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="bg-black/40 hover:bg-black/60 text-white rounded-full p-2 backdrop-blur-md transition-colors"
            title="Menu"
          >
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {/* Menu Dropdown */}
      {showMenu && (
        <div className="absolute top-16 right-4 z-50 bg-black/80 backdrop-blur-md rounded-lg shadow-xl border border-white/10 overflow-hidden">
          <button
            onClick={() => { setShowMenu(false); /* Add settings action */ }}
            className="w-full px-4 py-3 text-left text-sm text-gray-200 hover:bg-white/10 transition-colors"
          >
            Settings
          </button>
          <button
            onClick={() => { setShowMenu(false); /* Add help action */ }}
            className="w-full px-4 py-3 text-left text-sm text-gray-200 hover:bg-white/10 transition-colors"
          >
            Help
          </button>
        </div>
      )}

      {/* Click outside to close menu */}
      {showMenu && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        />
      )}

      {/* Main table area with strict Z-Index layering */}
      <div className="table-container relative h-full flex flex-col items-center justify-center">
        {/* Pot display - Z-Index: 10 */}
        <div ref={potRef} className="pot-display-container absolute top-[30%] left-1/2 -translate-x-1/2 z-10">
          <PotDisplay pots={pots} currency={table_metadata.currency as 'REAL' | 'PLAY'} />
        </div>

        {/* Community cards - Z-Index: 20 */}
        <div className="community-board-container absolute top-[42%] left-1/2 -translate-x-1/2 z-20">
          <CommunityBoard
            communityCards={community_cards}
            street={current_street}
          />
        </div>

        {/* Seats arranged in ellipse with tight spacing - Z-Index: 30 */}
        <div className="seats-container absolute inset-0 pb-36 z-30">
          {seatPositions.map(({ seat, xPercent, yPercent, isHero }) => {
            return (
              <div
                key={seat.seat_index}
                className="absolute m-1"
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
          <div className="action-panel-container fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
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
          <div className="join-button-container fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <button
              onClick={handleJoin}
              disabled={isJoining}
              className="bg-gradient-to-b from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-900/50 text-white font-bold px-8 h-12 rounded-full transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJoining ? 'Joining...' : 'Join Table'}
            </button>
          </div>
        )}

        {/* Draw phase UI (overlays action panel when active) - Z-Index: 50 */}
        {discard_phase_active && heroSeat && (
          <div className="draw-phase-container fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
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
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800/90 backdrop-blur-md rounded-2xl p-6 max-w-md w-full mx-4 border border-white/10">
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
                className="w-full px-4 py-3 bg-black/40 text-white rounded-full border border-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="text-xs text-gray-400 mt-2 px-2">
                Min: {table_metadata.buyin_limits.min} | Max: {table_metadata.buyin_limits.max}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowJoinModal(false)}
                className="flex-1 px-4 py-3 bg-black/40 hover:bg-black/60 text-white rounded-full font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBuyIn}
                disabled={isJoining}
                className="flex-1 px-4 py-3 bg-gradient-to-b from-emerald-500 to-emerald-700 text-white rounded-full font-semibold disabled:opacity-50 transition-all hover:scale-105"
              >
                {isJoining ? 'Joining...' : 'Join'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug info (development only) */}
      {import.meta.env.DEV && (
        <div className="absolute bottom-20 left-4 bg-black/60 backdrop-blur-sm text-white text-xs p-2 rounded-lg max-w-xs z-40">
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
