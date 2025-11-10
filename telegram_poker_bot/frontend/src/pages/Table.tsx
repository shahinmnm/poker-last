import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useTelegram } from '../hooks/useTelegram'

interface TableState {
  id: number
  status: string
  players: Array<{
    id: number
    position: number
    chips: number
  }>
  board: string[]
  pots: Array<{
    pot_index: number
    amount: number
  }>
  current_player: number | null
}

export default function TablePage() {
  const { tableId } = useParams<{ tableId: string }>()
  const { initData } = useTelegram()
  const [tableState, setTableState] = useState<TableState | null>(null)
  const [loading, setLoading] = useState(true)
  const { t } = useTranslation()

  useEffect(() => {
    // Fetch table state
    const fetchTable = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/tables/${tableId}`, {
          headers: {
            'X-Telegram-Init-Data': initData || '',
          },
        })
        const data = await response.json()
        setTableState(data)
      } catch (error) {
        console.error('Error fetching table:', error)
      } finally {
        setLoading(false)
      }
    }

    if (tableId) {
      fetchTable()
    }
  }, [tableId, initData])

  const handleAction = async (actionType: string, amount?: number) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/tables/${tableId}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData || '',
        },
        body: JSON.stringify({
          action_type: actionType,
          amount,
        }),
      })
      const data = await response.json()
      if (data.success) {
        // Refresh table state
        // In real app, would use WebSocket for updates
      }
    } catch (error) {
      console.error('Error submitting action:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-gray-500 dark:text-gray-300">
        {t('table.loading')}
      </div>
    )
  }

  if (!tableState) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-gray-500 dark:text-gray-300">
        {t('table.notFound')}
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-4">{t('table.title', { id: tableState.id })}</h1>

        {/* Board Cards */}
        <div className="mb-6 p-4 bg-green-100 dark:bg-green-900 rounded-lg">
          <h2 className="font-semibold mb-2">{t('table.board')}</h2>
          <div className="flex gap-2">
            {tableState.board.map((card, idx) => (
              <div key={idx} className="w-12 h-16 bg-white dark:bg-gray-800 rounded border-2 border-gray-300 flex items-center justify-center text-lg font-bold">
                {card}
              </div>
            ))}
          </div>
        </div>

        {/* Pots */}
        <div className="mb-6">
          <h2 className="font-semibold mb-2">{t('table.pots')}</h2>
          {tableState.pots.map((pot) => (
            <div key={pot.pot_index} className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded">
              {pot.pot_index === 0
                ? t('table.potMain')
                : t('table.potSide', { index: pot.pot_index })}
              : {t('table.chips', { amount: pot.amount })}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-300 dark:border-gray-700">
          <div className="max-w-2xl mx-auto grid grid-cols-2 gap-2">
            <button
              onClick={() => handleAction('fold')}
              className="p-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600"
            >
              {t('table.actions.fold')}
            </button>
            <button
              onClick={() => handleAction('check')}
              className="p-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600"
            >
              {t('table.actions.check')}
            </button>
            <button
              onClick={() => handleAction('call')}
              className="p-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600"
            >
              {t('table.actions.call')}
            </button>
            <button
              onClick={() => handleAction('bet', 100)}
              className="p-3 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600"
            >
              {t('table.actions.bet')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
