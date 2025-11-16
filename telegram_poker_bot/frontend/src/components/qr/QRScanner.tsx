import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import Modal from '../ui/Modal'
import Card from '../ui/Card'

export interface QRScannerProps {
  isOpen: boolean
  onClose: () => void
  onScan: (code: string) => void
}

/**
 * QR Scanner component placeholder.
 * 
 * This provides the infrastructure for QR code scanning.
 * Implementation options:
 * 1. Use Telegram WebApp's QR scanner API if available
 * 2. Integrate a third-party QR library (e.g., html5-qrcode)
 * 3. Fallback to manual entry
 */
export default function QRScanner({ isOpen, onClose, onScan }: QRScannerProps) {
  const { t } = useTranslation()
  const [scanError, setScanError] = useState<string | null>(null)

  const handleTelegramQRScan = useCallback(() => {
    // Check if Telegram WebApp QR scanner is available
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.showScanQrPopup) {
      try {
        ;(window as any).Telegram.WebApp.showScanQrPopup(
          {
            text: t('joinGame.form.scanButton'),
          },
          (result: string) => {
            if (result) {
              // QR code scanned successfully
              onScan(result)
              onClose()
            }
          }
        )
      } catch (error) {
        console.error('Error opening Telegram QR scanner:', error)
        setScanError('QR scanner not available')
      }
    } else {
      setScanError('QR scanner not available in this environment')
    }
  }, [onScan, onClose, t])

  const handleManualEntry = useCallback(() => {
    onClose()
  }, [onClose])

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('joinGame.form.scanButton')}
      description={t('joinGame.description')}
    >
      <div className="space-y-4">
        {scanError && (
          <Card variant="overlay" padding="sm">
            <p className="text-caption text-[color:var(--danger)]">{scanError}</p>
          </Card>
        )}

        <Card variant="overlay" padding="md">
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-2xl bg-[color:var(--surface-base)]">
              <span className="text-6xl">📷</span>
            </div>
            <div>
              <h3 className="text-section-title mb-2">
                {t('joinGame.qr.title', { defaultValue: 'Scan QR Code' })}
              </h3>
              <p className="text-caption text-[color:var(--text-muted)]">
                {t('joinGame.qr.description', { 
                  defaultValue: 'Point your camera at the QR code shared by the host' 
                })}
              </p>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleTelegramQRScan}
            className="app-button app-button--primary app-button--lg w-full"
          >
            {t('joinGame.qr.openScanner', { defaultValue: 'Open QR Scanner' })}
          </button>
          <button
            onClick={handleManualEntry}
            className="app-button app-button--ghost app-button--md w-full"
          >
            {t('joinGame.qr.manualEntry', { defaultValue: 'Enter code manually' })}
          </button>
        </div>
      </div>
    </Modal>
  )
}
