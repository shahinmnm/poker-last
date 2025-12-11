import { type ReactNode, useEffect, useState } from 'react'

type TelegramWebApp = {
  requestFullscreen?: () => void
}

type ScreenOrientationLock =
  | 'any'
  | 'natural'
  | 'landscape'
  | 'portrait'
  | 'landscape-primary'
  | 'landscape-secondary'
  | 'portrait-primary'
  | 'portrait-secondary'

type ScreenOrientationWithLock = ScreenOrientation & {
  lock: (orientation: ScreenOrientationLock) => Promise<void>
}

function hasOrientationLock(value: ScreenOrientation | undefined): value is ScreenOrientationWithLock {
  return !!value && typeof (value as ScreenOrientationWithLock).lock === 'function'
}

const RotateIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className="h-9 w-9 text-white/80"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M12 5v-2m0 18v-2m7-7h2M3 12h2m10.24-6.24 1.42-1.42M5.34 18.66l1.42-1.42m9.9 1.42 1.42 1.42M5.34 5.34l1.42 1.42" />
  </svg>
)

function isPortrait() {
  if (typeof window === 'undefined') {
    return false
  }
  return window.innerHeight > window.innerWidth
}

interface OrientationGuardProps {
  children: ReactNode
}

const OrientationGuard = ({ children }: OrientationGuardProps) => {
  const [portrait, setPortrait] = useState<boolean>(() => isPortrait())

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleOrientationChange = () => {
      setPortrait(isPortrait())
    }

    window.addEventListener('resize', handleOrientationChange)
    window.addEventListener('orientationchange', handleOrientationChange)

    const telegram = 'Telegram' in window ? window.Telegram : undefined
    const webApp = telegram?.WebApp as TelegramWebApp | undefined
    try {
      webApp?.requestFullscreen?.()
    } catch {
      /* Ignore fullscreen failures */
    }

    try {
      const orientation = window.screen?.orientation
      if (hasOrientationLock(orientation)) {
        orientation.lock('landscape').catch(() => {
          /* Silently ignore orientation lock failures (unsupported on many mobile browsers) */
        })
      }
    } catch {
      /* Ignore orientation lock failures */
    }

    return () => {
      window.removeEventListener('resize', handleOrientationChange)
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [])

  return (
    <div className="relative min-h-screen bg-[var(--color-bg-gradient)]">
      {portrait && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 px-8 text-center text-white backdrop-blur-md">
          <div className="relative h-24 w-24">
            {/* Positioned border rings spaced with Tailwind tokens (inset-6 / inset-2) for visual balance */}
            <div className="absolute inset-6 rounded-2xl border-2 border-white/30" />
            <div className="absolute inset-2 rounded-3xl border border-white/15" />
            <div className="absolute inset-0 flex items-center justify-center">
              <RotateIcon />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-semibold">Rotate your device</p>
            <p className="text-base text-white/70">
              This poker table is built for landscape. Turn your phone to keep playing.
            </p>
          </div>
        </div>
      )}
      <div aria-hidden={portrait} tabIndex={portrait ? -1 : undefined}>
        {children}
      </div>
    </div>
  )
}

export default OrientationGuard
