import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import Modal from '../ui/Modal'
import Button from '../ui/Button'

interface PostHandModalProps {
  isOpen: boolean
  delaySeconds: number
  onComplete: () => void
  onReady: () => void
  isReady: boolean
}

export default function PostHandModal({
  isOpen,
  delaySeconds,
  onComplete,
  onReady,
  isReady,
}: PostHandModalProps) {
  const { t } = useTranslation()
  const [remainingTime, setRemainingTime] = useState(delaySeconds)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    if (!isOpen) {
      setRemainingTime(delaySeconds)
      setProgress(100)
      return
    }

    const startTime = Date.now()
    const totalMs = delaySeconds * 1000

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, totalMs - elapsed)
      const remainingSec = Math.ceil(remaining / 1000)
      const progressPercent = (remaining / totalMs) * 100

      setRemainingTime(remainingSec)
      setProgress(progressPercent)

      if (remaining <= 0) {
        clearInterval(interval)
        // Rule 4 & 5: Auto-trigger next hand when countdown reaches 0
        // If user didn't click "I'm Ready", they will sit out (backend default behavior)
        onComplete()
      }
    }, 50) // Update every 50ms for smooth animation

    return () => clearInterval(interval)
  }, [isOpen, delaySeconds, onComplete])

  const handleReady = useCallback(() => {
    onReady()
  }, [onReady])

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}} // Prevent closing during countdown
      title={t('table.postHand.title', 'Next Hand Starting')}
      className="max-w-sm"
    >
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-body text-[color:var(--color-text-muted)]">
            {isReady
              ? t('table.postHand.readyMessage', 'You\'re ready!')
              : t('table.postHand.message', 'Click to play next hand or sit out automatically')
            }
          </p>
          <div className="mt-4 text-4xl font-bold text-[color:var(--color-primary)]">
            {remainingTime}s
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Action button */}
        <div className="flex flex-col gap-3">
          <Button
            variant={isReady ? 'secondary' : 'primary'}
            size="md"
            onClick={handleReady}
            disabled={isReady}
            glow={!isReady}
            block
          >
            {isReady
              ? t('table.postHand.readyConfirmed', '✓ Ready')
              : t('table.postHand.ready', "I'm Ready")
            }
          </Button>

          <p className="text-center text-xs text-[color:var(--color-text-muted)]">
            {isReady
              ? t('table.postHand.readyNote', 'You will play in the next hand')
              : t('table.postHand.autoSitOutNote', 'You will sit out if you don\'t click')
            }
          </p>
        </div>
      </div>
    </Modal>
  )
}
