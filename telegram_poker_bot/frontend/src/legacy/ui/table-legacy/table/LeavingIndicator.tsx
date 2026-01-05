import clsx from 'clsx'
import { useTranslation } from 'react-i18next'

interface LeavingIndicatorProps {
  interactive?: boolean
  className?: string
}

export default function LeavingIndicator({ interactive = false, className }: LeavingIndicatorProps) {
  const { t } = useTranslation()
  const label = t('table.actions.leavingAfterHand', { defaultValue: 'Leaving after hand' })

  return (
    <div className={clsx('leaving-indicator', className)}>
      <button
        type="button"
        className={clsx('leaving-indicator__button', !interactive && 'pointer-events-none')}
        aria-label={label}
      >
        <span aria-hidden>{'\uD83D\uDEAA'}</span>
      </button>
    </div>
  )
}
