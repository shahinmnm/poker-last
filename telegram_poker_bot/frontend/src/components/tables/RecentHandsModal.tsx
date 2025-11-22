import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../ui/Modal'
import { apiFetch } from '../../utils/apiClient'

interface HandHistoryWinner {
  user_id: number
  amount: number
  hand_rank: string
  best_hand_cards: string[]
}

interface HandHistoryItem {
  hand_no: number
  board: string[]
  winners: HandHistoryWinner[]
  pot_total: number
  created_at: string | null
}

interface HandHistoryEvent {
  id: number
  sequence: number
  street: string
  action_type: string
  actor_user_id: number | null
  actor_display_name: string | null
  amount: number | null
  pot_size: number
  board_cards: string[] | null
  created_at: string | null
}

interface HandDetailResponse {
  hand: {
    hand_id: number
    hand_no: number
    table_id: number
    started_at: string | null
    ended_at: string | null
  }
  events: HandHistoryEvent[]
}

interface RecentHandsModalProps {
  isOpen: boolean
  onClose: () => void
  tableId: number
  initData?: string
}

const HAND_RANK_LABEL: Record<string, string> = {
  high_card: 'High Card',
  pair: 'Pair',
  two_pair: 'Two Pair',
  three_of_a_kind: 'Three of a Kind',
  straight: 'Straight',
  flush: 'Flush',
  full_house: 'Full House',
  four_of_a_kind: 'Four of a Kind',
  straight_flush: 'Straight Flush',
}

export default function RecentHandsModal({
  isOpen,
  onClose,
  tableId,
  initData,
}: RecentHandsModalProps) {
  const { t } = useTranslation()
  const [hands, setHands] = useState<HandHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedHandId, setSelectedHandId] = useState<number | null>(null)
  const [handDetail, setHandDetail] = useState<HandDetailResponse | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchHands()
    } else {
      setSelectedHandId(null)
      setHandDetail(null)
    }
  }, [isOpen, tableId])

  const fetchHands = async () => {
    setLoading(true)
    try {
      const data = await apiFetch<{ hands: HandHistoryItem[] }>(
        `/tables/${tableId}/hands?limit=10`,
        {
          method: 'GET',
          initData,
        }
      )
      setHands(data.hands)
    } catch (err) {
      // Silently handle error - UI will show empty state
    } finally {
      setLoading(false)
    }
  }

  const fetchHandDetail = async (handId: number) => {
    setLoadingDetail(true)
    try {
      const data = await apiFetch<HandDetailResponse>(
        `/hands/${handId}/history`,
        {
          method: 'GET',
          initData,
        }
      )
      setHandDetail(data)
    } catch (err) {
      // Silently handle error - UI will show loading state
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleViewDetails = (handNo: number) => {
    // In a real app, we'd need to get the hand ID from somewhere
    // For now, we'll just use handNo as a proxy (this is a limitation)
    // The better approach would be to include hand_id in the summary endpoint
    setSelectedHandId(handNo)
    fetchHandDetail(handNo)
  }

  const handleBackToList = () => {
    setSelectedHandId(null)
    setHandDetail(null)
  }

  // Group events by street
  const groupEventsByStreet = (events: HandHistoryEvent[]) => {
    const streets = ['preflop', 'flop', 'turn', 'river', 'showdown']
    const grouped: Record<string, HandHistoryEvent[]> = {}
    
    events.forEach(event => {
      if (!grouped[event.street]) {
        grouped[event.street] = []
      }
      grouped[event.street].push(event)
    })
    
    return streets
      .filter(street => grouped[street])
      .map(street => ({
        street,
        events: grouped[street],
      }))
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={selectedHandId ? t('table.recentHands.timeline') : t('table.recentHands.title')}
    >
      {selectedHandId && (
        <button
          onClick={handleBackToList}
          className="mb-3 text-xs text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
        >
          ← {t('common.actions.view')} {t('table.recentHands.title')}
        </button>
      )}

      {!selectedHandId && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {loading && (
            <div className="text-center py-8 text-sm text-[color:var(--text-muted)]">
              {t('common.loading')}
            </div>
          )}

          {!loading && hands.length === 0 && (
            <div className="text-center py-8 text-sm text-[color:var(--text-muted)]">
              {t('table.recentHands.empty')}
            </div>
          )}

          {!loading &&
            hands.map((hand) => (
              <div
                key={hand.hand_no}
                className="rounded-lg p-3 cursor-pointer transition-opacity hover:opacity-80"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }}
                onClick={() => handleViewDetails(hand.hand_no)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[color:var(--text-primary)]">
                    {t('table.recentHands.handNo', { number: hand.hand_no })}
                  </span>
                  <span className="text-xs text-[color:var(--text-muted)]">
                    {t('table.recentHands.pot')}: {hand.pot_total}
                  </span>
                </div>

                {hand.board.length > 0 && (
                  <div className="text-[10px] text-[color:var(--text-muted)] mb-2">
                    {t('table.recentHands.board')}: {hand.board.join(' ')}
                  </div>
                )}

                <div className="space-y-1">
                  {hand.winners.map((winner, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-emerald-400 font-medium">
                        {hand.winners.length === 1
                          ? t('table.recentHands.winner')
                          : t('table.recentHands.winners')}{' '}
                        #{winner.user_id}
                      </span>
                      <span className="text-[color:var(--text-muted)]">
                        {HAND_RANK_LABEL[winner.hand_rank] || winner.hand_rank} +
                        {winner.amount}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-2 pt-2 border-t border-[color:var(--glass-border)]">
                  <span className="text-[10px] text-[color:var(--text-muted)]">
                    {t('table.recentHands.viewDetails')} →
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}

      {selectedHandId && (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {loadingDetail && (
            <div className="text-center py-8 text-sm text-[color:var(--text-muted)]">
              {t('common.loading')}
            </div>
          )}

          {!loadingDetail && handDetail && (
            <>
              {groupEventsByStreet(handDetail.events).map((streetGroup) => (
                <div key={streetGroup.street} className="space-y-2">
                  <h3 className="text-sm font-semibold text-[color:var(--text-primary)] uppercase">
                    {t(`table.recentHands.streets.${streetGroup.street}`)}
                  </h3>
                  <div className="space-y-1.5">
                    {streetGroup.events.map((event) => (
                      <div
                        key={event.id}
                        className="rounded px-2.5 py-1.5 text-xs"
                        style={{
                          background: 'var(--glass-bg)',
                          border: '1px solid var(--glass-border)',
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <span className="font-medium text-[color:var(--text-primary)]">
                              {event.actor_display_name || event.actor_user_id || t('table.recentHands.system')}
                            </span>
                            {' '}
                            <span className="text-[color:var(--text-muted)]">
                              {t(`table.recentHands.actions.${event.action_type}`)}
                            </span>
                            {event.amount && event.amount > 0 && (
                              <span className="ml-1 text-[color:var(--text-primary)]">
                                {event.amount}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[color:var(--text-muted)] whitespace-nowrap">
                            {t('table.recentHands.potSize', { amount: event.pot_size })}
                          </div>
                        </div>
                        {event.board_cards && event.board_cards.length > 0 && (
                          <div className="mt-1 text-[10px] text-[color:var(--text-muted)]">
                            {t('table.recentHands.board')}: {event.board_cards.join(' ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
