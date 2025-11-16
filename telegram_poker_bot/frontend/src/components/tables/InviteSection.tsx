import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import Card from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { buildInviteUrl } from '../../utils/invite'

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

  const inviteUrl = useMemo(() => buildInviteUrl(inviteCode), [inviteCode])

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
    const fullText = `${shareText}: ${inviteUrl}`
    
    // Use Telegram WebApp share if available
    try {
      const telegram = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } }).Telegram
      if (telegram?.WebApp?.openTelegramLink) {
        const encodedText = encodeURIComponent(fullText)
        const encodedUrl = encodeURIComponent(inviteUrl)
        telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`)
      } else if (navigator.share) {
        // Fallback to Web Share API
        navigator
          .share({
            text: fullText,
            url: inviteUrl,
          })
          .catch((error) => {
            console.error('Error sharing:', error)
          })
      } else {
        // Fallback to copy
        handleCopy()
      }
    } catch (error) {
      console.error('Error sharing:', error)
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

        <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-base)]/40 p-4 sm:flex-row sm:items-center">
          <div className="flex-1 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
              {t('table.invite.qrLabel', { defaultValue: 'Invite QR' })}
            </p>
            <p className="text-sm text-[color:var(--text-muted)]">
              {t('table.invite.qrHint', {
                defaultValue: 'Friends can scan this to open the table with the code pre-filled.',
              })}
            </p>
            <p className="text-sm font-semibold text-[color:var(--text-primary)] break-all">{inviteUrl}</p>
          </div>
          <div className="mx-auto rounded-2xl border border-[color:var(--surface-border)] bg-white p-3 dark:bg-white">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(inviteUrl)}`}
              alt={t('table.invite.qrLabel') ?? 'QR'}
              className="h-36 w-36 rounded-xl"
            />
          </div>
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
