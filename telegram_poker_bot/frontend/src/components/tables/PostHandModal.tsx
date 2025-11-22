import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import Modal from '../ui/Modal'
import Button from '../ui/Button'

interface PostHandModalProps {
  isOpen: boolean
  delaySeconds: number
  onComplete: () => void
  onSitOut: () => void
  onKeepPlaying: () => void
  isSittingOut: boolean
}

export default function PostHandModal({
  isOpen,
  delaySeconds,
  onComplete,
  onSitOut,
  onKeepPlaying,
  isSittingOut,
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
        onComplete()
      }
    }, 50) // Update every 50ms for smooth animation

    return () => clearInterval(interval)
  }, [isOpen, delaySeconds, onComplete])

  const handleSitOut = useCallback(() => {
    onSitOut()
  }, [onSitOut])

  const handleKeepPlaying = useCallback(() => {
    onKeepPlaying()
  }, [onKeepPlaying])

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
            {t('table.postHand.message', 'Get ready for the next hand')}
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

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            variant={isSittingOut ? 'primary' : 'secondary'}
            size="md"
            onClick={handleKeepPlaying}
            disabled={!isSittingOut}
            block
          >
            {t('table.postHand.keepPlaying', 'Keep Playing')}
          </Button>
          <Button
            variant={isSittingOut ? 'secondary' : 'danger'}
            size="md"
            onClick={handleSitOut}
            disabled={isSittingOut}
            block
          >
            {t('table.postHand.sitOut', 'Sit Out')}
          </Button>
        </div>

        {isSittingOut && (
          <p className="text-center text-xs text-amber-400">
            {t('table.postHand.sittingOutNote', 'You will sit out the next hand')}
          </p>
        )}
      </div>
    </Modal>
  )
}
