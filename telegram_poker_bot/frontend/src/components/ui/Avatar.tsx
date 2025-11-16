import { useEffect, useState } from 'react'
import { useTelegram } from '../../hooks/useTelegram'
import { cn } from '../../utils/cn'

interface AvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
  xl: 'h-24 w-24',
}

export default function Avatar({ size = 'md', className }: AvatarProps) {
  const { initData } = useTelegram()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!initData) {
      setLoading(false)
      return
    }

    const apiUrl = import.meta.env.VITE_API_URL || '/api'
    const url = `${apiUrl}/users/me/avatar`

    // Create a new image to preload
    const img = new Image()
    img.onload = () => {
      setAvatarUrl(url)
      setLoading(false)
      setError(false)
    }
    img.onerror = () => {
      setLoading(false)
      setError(true)
    }

    // Set auth header via fetch and convert to blob URL
    fetch(url, {
      headers: {
        'X-Telegram-Init-Data': initData,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load avatar')
        return res.blob()
      })
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob)
        img.src = blobUrl
        // Clean up old blob URL if exists
        return () => URL.revokeObjectURL(blobUrl)
      })
      .catch(() => {
        setLoading(false)
        setError(true)
      })
  }, [initData])

  if (loading) {
    return (
      <div
        className={cn(
          'animate-pulse rounded-[var(--radius-pill)] bg-[color:var(--color-surface-overlay)]',
          sizeClasses[size],
          className
        )}
      />
    )
  }

  if (error || !avatarUrl) {
    // Fallback to poker icon
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-[var(--radius-pill)] bg-gradient-to-br from-[color:var(--color-accent-start)] to-[color:var(--color-accent-end)] text-white font-semibold',
          sizeClasses[size],
          className
        )}
      >
        {size === 'sm' && '🎲'}
        {size === 'md' && <span className="text-[var(--font-size-2xl)]">🎲</span>}
        {size === 'lg' && <span className="text-[var(--font-size-3xl)]">🎲</span>}
        {size === 'xl' && <span className="text-4xl">🎲</span>}
      </div>
    )
  }

  return (
    <img
      src={avatarUrl}
      alt="User avatar"
      className={cn(
        'rounded-[var(--radius-pill)] border-2 border-[color:var(--color-border)] object-cover',
        sizeClasses[size],
        className
      )}
    />
  )
}
