import { useTranslation } from 'react-i18next'

import Modal from '../../../../components/ui/Modal'

interface TableExpiredModalProps {
  isOpen: boolean
  reason: string
  onClose: () => void
}

export default function TableExpiredModal({
  isOpen,
  reason,
  onClose,
}: TableExpiredModalProps) {
  const { t } = useTranslation()

  // Check if the reason contains "lack of minimum players" or similar phrases
  const isMinPlayerIssue = reason.toLowerCase().includes('lack of minimum players') 
    || reason.toLowerCase().includes('minimum players')
    || reason.toLowerCase().includes('insufficient active players')
  
  const displayReason = isMinPlayerIssue
    ? t('table.expired.lackOfPlayers', 'Table deleted due to lack of minimum players')
    : t('table.expired.generic', 'Table has expired')

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('table.expired.title', 'Table Ended')}
      confirmLabel={t('table.expired.confirm', 'OK')}
      onConfirm={onClose}
      confirmVariant="primary"
    >
      <div className="text-center">
        <div className="mb-4 text-5xl">⏰</div>
        <p className="text-body text-[color:var(--color-text)]">{displayReason}</p>
        {reason && (
          <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">{reason}</p>
        )}
      </div>
    </Modal>
  )
}
