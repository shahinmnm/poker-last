import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'

interface LeavingIndicatorProps {
  interactive?: boolean
  className?: string
}

export default function LeavingIndicator({ interactive = false, className }: LeavingIndicatorProps) {
  const { t } = useTranslation()
  const [showTip, setShowTip] = useState(false)

  useEffect(() => {
    if (!showTip) return
    const timer = window.setTimeout(() => setShowTip(false), 2000)
    return () => window.clearTimeout(timer)
  }, [showTip])

  const label = t('table.actions.leavingAfterHand', { defaultValue: 'Leaving after hand' })

  return (
    <div className={clsx('leaving-indicator', className)}>
      <button
        type="button"
        className={clsx('leaving-indicator__button', !interactive && 'pointer-events-none')}
        aria-label={label}
        title={label}
        onClick={interactive ? () => setShowTip(true) : undefined}
      >
        <span aria-hidden>{'\uD83D\uDEAA'}</span>
      </button>
      {showTip && (
        <div className="leaving-indicator__tooltip" role="status" dir="auto">
          {label}
        </div>
      )}
    </div>
  )
}
