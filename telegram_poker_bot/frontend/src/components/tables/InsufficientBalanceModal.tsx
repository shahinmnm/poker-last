import { useTranslation } from 'react-i18next'

import Modal from '../ui/Modal'

interface InsufficientBalanceModalProps {
  isOpen: boolean
  required: number
  current: number
  onClose: () => void
}

export default function InsufficientBalanceModal({
  isOpen,
  required,
  current,
  onClose,
}: InsufficientBalanceModalProps) {
  const { t } = useTranslation()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('table.insufficientBalance.title', 'Insufficient Balance')}
      confirmLabel={t('table.insufficientBalance.confirm', 'OK')}
      onConfirm={onClose}
      confirmVariant="primary"
    >
      <div className="text-center">
        <div className="mb-4 text-5xl">💰</div>
        <p className="mb-2 text-body text-[color:var(--color-text)]">
          {t(
            'table.insufficientBalance.message',
            'No sit due to lack of balance'
          )}
        </p>
        <div className="mt-4 space-y-2 text-sm text-[color:var(--color-text-muted)]">
          <div className="flex justify-between">
            <span>{t('table.insufficientBalance.required', 'Required:')}</span>
            <span className="font-semibold text-amber-400">{required}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('table.insufficientBalance.current', 'Your Balance:')}</span>
            <span className="font-semibold text-rose-400">{current}</span>
          </div>
        </div>
        <p className="mt-4 text-xs text-[color:var(--color-text-muted)]">
          {t(
            'table.insufficientBalance.note',
            'You have been automatically set to sit out for the next hand.'
          )}
        </p>
      </div>
    </Modal>
  )
}
