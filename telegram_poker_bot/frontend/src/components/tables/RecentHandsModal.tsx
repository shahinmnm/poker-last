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

  useEffect(() => {
    if (isOpen) {
      fetchHands()
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
      console.error('Failed to fetch hand history', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('table.recentHands.title')}>
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
              className="rounded-lg p-3"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
              }}
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
                  Board: {hand.board.join(' ')}
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
            </div>
          ))}
      </div>
    </Modal>
  )
}
