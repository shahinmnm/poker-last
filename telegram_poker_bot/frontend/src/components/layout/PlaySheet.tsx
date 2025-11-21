import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUsers, faUserGroup, faUsersRectangle, faQrcode, faXmark } from '@fortawesome/free-solid-svg-icons'

interface PlaySheetProps {
  isOpen: boolean
  onClose: () => void
}

export default function PlaySheet({ isOpen, onClose }: PlaySheetProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleNavigate = (path: string) => {
    navigate(path)
    onClose()
  }

  if (!isOpen) return null

  const options = [
    {
      key: 'public',
      icon: faUsers,
      label: t('playSheet.public.label', 'Play Public Tables'),
      subtitle: t('playSheet.public.subtitle', 'Join live tables'),
      path: '/lobby',
      color: 'from-blue-500 to-blue-600',
    },
    {
      key: 'private',
      icon: faUserGroup,
      label: t('playSheet.private.label', 'Play with Friends'),
      subtitle: t('playSheet.private.subtitle', 'Create private table'),
      path: '/games/create?mode=private',
      color: 'from-purple-500 to-purple-600',
    },
    {
      key: 'group',
      icon: faUsersRectangle,
      label: t('playSheet.group.label', 'Start Group Game'),
      subtitle: t('playSheet.group.subtitle', 'Launch in Telegram group'),
      path: '/group/invite',
      color: 'from-green-500 to-green-600',
    },
    {
      key: 'qr',
      icon: faQrcode,
      label: t('playSheet.qr.label', 'Join via QR'),
      subtitle: t('playSheet.qr.subtitle', 'Scan QR code'),
      path: '/games/join',
      color: 'from-orange-500 to-orange-600',
    },
  ]

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        style={{ transition: 'opacity 0.2s ease' }}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe"
        style={{
          animation: 'slideUp 0.2s ease-out',
        }}
      >
        <div
          className="mx-auto max-w-4xl rounded-t-3xl p-6"
          style={{
            background: 'var(--glass-bg-elevated)',
            backdropFilter: 'blur(var(--glass-blur))',
            WebkitBackdropFilter: 'blur(var(--glass-blur))',
            border: '1px solid var(--glass-border)',
            borderBottom: 'none',
            boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.2)',
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
              {t('playSheet.title', 'Choose Game Mode')}
            </h2>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-transform active:scale-95"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>

          <div className="grid gap-3">
            {options.map((option) => (
              <button
                key={option.key}
                onClick={() => handleNavigate(option.path)}
                className="group relative flex items-center gap-4 overflow-hidden rounded-2xl p-4 text-left transition-all active:scale-98"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  boxShadow: 'var(--shadow-soft)',
                }}
              >
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ${option.color}`}
                >
                  <FontAwesomeIcon icon={option.icon} className="text-xl" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                    {option.label}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {option.subtitle}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
