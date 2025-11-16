import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import Card from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'

export interface InviteSectionProps {
  inviteCode: string
  expiresAt?: string | null
  onCopySuccess?: () => void
  onCopyError?: () => void
}

export default function InviteSection({
  inviteCode,
  expiresAt,
  onCopySuccess,
  onCopyError,
}: InviteSectionProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      onCopySuccess?.()
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      onCopyError?.()
    }
  }, [inviteCode, onCopySuccess, onCopyError])

  const handleShare = useCallback(() => {
    const shareText = t('table.invite.shareText')
    const fullText = `${shareText}: ${inviteCode}`
    
    // Use Telegram WebApp share if available
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.openTelegramLink) {
      const encodedText = encodeURIComponent(fullText)
      ;(window as any).Telegram.WebApp.openTelegramLink(`https://t.me/share/url?text=${encodedText}`)
    } else if (navigator.share) {
      // Fallback to Web Share API
      navigator
        .share({
          text: fullText,
        })
        .catch((error) => {
          console.error('Error sharing:', error)
        })
    } else {
      // Fallback to copy
      handleCopy()
    }
  }, [inviteCode, t, handleCopy])

  const expiresDate = expiresAt ? new Date(expiresAt) : null
  const isExpired = expiresDate && expiresDate.getTime() < Date.now()

  return (
    <Card variant="overlay" padding="md">
      <div className="space-y-4">
        <div>
          <h3 className="text-section-title mb-1">{t('table.invite.title')}</h3>
          <p className="text-caption text-[color:var(--text-muted)]">
            {t('table.invite.hint')}
          </p>
        </div>

        <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-base)]/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
              {t('table.invite.codeLabel')}
            </span>
            {isExpired && (
              <Badge variant="muted" size="sm">
                {t('table.invite.status.expired')}
              </Badge>
            )}
          </div>
          <div className="font-mono text-2xl font-bold tracking-widest text-[color:var(--text-primary)] sm:text-3xl">
            {inviteCode}
          </div>
          {expiresDate && !isExpired && (
            <p className="mt-2 text-xs text-[color:var(--text-muted)]">
              {t('table.invite.expires', {
                value: expiresDate.toLocaleString(),
              })}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant={copied ? 'secondary' : 'primary'}
            size="md"
            onClick={handleCopy}
            disabled={isExpired || false}
            className="flex-1"
          >
            {copied ? '✓ ' + t('table.invite.copied') : t('table.invite.copy')}
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={handleShare}
            disabled={isExpired || false}
            className="flex-1"
          >
            {t('table.invite.share')}
          </Button>
        </div>
      </div>
    </Card>
  )
}
