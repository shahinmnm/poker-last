import { type ReactNode, useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

interface OrientationGuardProps {
  children: ReactNode
}

/**
 * OrientationGuard - A "Soft Lock" component for landscape orientation
 * 
 * This component detects when a mobile device is in portrait mode and displays
 * an overlay asking the user to rotate their device to landscape.
 * 
 * Why "Soft Lock" instead of CSS rotation:
 * - CSS transform: rotate(90deg) causes touch event misalignment
 * - Native OS elements (keyboard, notifications) remain in original orientation
 * - Better UX as users naturally rotate their device
 * - Industry standard approach used by major HTML5 game engines (Phaser, Unity WebGL)
 */
export function OrientationGuard({ children }: OrientationGuardProps) {
  const [isPortrait, setIsPortrait] = useState(false)
  const hasAttemptedNativeLock = useRef(false)

  const checkOrientation = useCallback(() => {
    // Consider portrait if height > width
    const portrait = window.innerHeight > window.innerWidth
    setIsPortrait(portrait)
  }, [])

  useEffect(() => {
    // Initial check
    checkOrientation()

    // Listen for orientation and resize changes
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)

    // Attempt native orientation lock APIs only once per session
    if (!hasAttemptedNativeLock.current) {
      hasAttemptedNativeLock.current = true
      tryNativeOrientationLock()
    }

    return () => {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
    }
  }, [checkOrientation])

  return (
    <>
      {children}
      {isPortrait && <RotateOverlay />}
    </>
  )
}

/**
 * Attempt to use native APIs for orientation locking
 * These will fail silently on most mobile browsers but work on some Android PWAs
 */
function tryNativeOrientationLock() {
  // Try Telegram WebApp fullscreen API
  try {
    const tg = window.Telegram?.WebApp
    if (tg && 'requestFullscreen' in tg && typeof tg.requestFullscreen === 'function') {
      tg.requestFullscreen()
    }
  } catch {
    // Silently ignore - not supported
  }

  // Try native Screen Orientation API
  try {
    if ('orientation' in screen && screen.orientation && 'lock' in screen.orientation) {
      const orientation = screen.orientation as ScreenOrientation & { lock?: (type: string) => Promise<void> }
      if (typeof orientation.lock === 'function') {
        orientation.lock('landscape').catch(() => {
          // Silently ignore - orientation lock not supported or not in fullscreen
        })
      }
    }
  } catch {
    // Silently ignore - API not available
  }
}

/**
 * Full-screen overlay displayed when device is in portrait mode
 */
function RotateOverlay() {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm"
      style={{ touchAction: 'none' }}
    >
      {/* Animated phone icon */}
      <div className="relative mb-8">
        <div className="animate-rotate-phone">
          <PhoneIcon />
        </div>
        {/* Rotation arrow */}
        <div className="absolute -right-4 top-1/2 -translate-y-1/2">
          <RotateArrowIcon />
        </div>
      </div>

      {/* Message */}
      <h2 className="text-xl font-semibold text-white mb-2">
        Please Rotate Your Device
      </h2>
      <p className="text-sm text-white/70 text-center max-w-xs px-4">
        This game is best experienced in landscape mode
      </p>
    </div>,
    document.body
  )
}

/**
 * Phone SVG icon
 */
function PhoneIcon() {
  return (
    <svg
      width="64"
      height="96"
      viewBox="0 0 64 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-white"
    >
      <rect
        x="4"
        y="4"
        width="56"
        height="88"
        rx="8"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <circle cx="32" cy="82" r="4" fill="currentColor" />
      <rect x="24" y="12" width="16" height="4" rx="2" fill="currentColor" opacity="0.5" />
    </svg>
  )
}

/**
 * Rotation arrow SVG icon
 */
function RotateArrowIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-white/80 animate-pulse"
    >
      <path
        d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"
        fill="currentColor"
      />
    </svg>
  )
}

export default OrientationGuard
