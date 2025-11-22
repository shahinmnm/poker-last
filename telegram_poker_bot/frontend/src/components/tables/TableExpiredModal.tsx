import { useTranslation } from 'react-i18next'

import Modal from '../ui/Modal'

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

  const displayReason = reason.includes('lack of minimum players')
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
      </div>
    </Modal>
  )
}
