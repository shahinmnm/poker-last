import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCoins } from '@fortawesome/free-solid-svg-icons'

import type { MenuNode } from '../../config/menu'
import { cn } from '../../utils/cn'

const AUTO_COLLAPSE_MS = 2500

interface FloatingNavPillProps {
  items: MenuNode[]
}

export default function FloatingNavPill({ items }: FloatingNavPillProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const navRef = useRef<HTMLDivElement | null>(null)
  const collapseTimerRef = useRef<number | null>(null)

  const clearAutoCollapse = useCallback(() => {
    if (collapseTimerRef.current !== null) {
      window.clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = null
    }
  }, [])

  const scheduleAutoCollapse = useCallback(() => {
    clearAutoCollapse()
    collapseTimerRef.current = window.setTimeout(() => {
      setOpen(false)
    }, AUTO_COLLAPSE_MS)
  }, [clearAutoCollapse])

  useEffect(() => {
    if (!open) {
      clearAutoCollapse()
      return
    }
    scheduleAutoCollapse()
    return clearAutoCollapse
  }, [clearAutoCollapse, open, scheduleAutoCollapse])

  useEffect(() => {
    if (!open) return
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (!navRef.current) return
      if (!navRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev
      if (next) {
        scheduleAutoCollapse()
      } else {
        clearAutoCollapse()
      }
      return next
    })
  }

  const handleInteract = () => {
    if (open) {
      scheduleAutoCollapse()
    }
  }

  return (
    <div
      ref={navRef}
      className={cn('floating-nav-pill', open && 'is-open')}
      onPointerDown={handleInteract}
    >
      <button
        type="button"
        onClick={handleToggle}
        className="floating-nav-pill__toggle"
        aria-expanded={open}
        aria-label={t('nav.quick', 'Quick navigation')}
      >
        <FontAwesomeIcon icon={faCoins} />
      </button>
      <div className="floating-nav-pill__items">
        {items.map((item) => (
          <NavLink
            key={item.key}
            to={item.path}
            end={item.path === '/'}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn('floating-nav-pill__item', isActive && 'is-active')
            }
            aria-label={t(item.labelKey)}
          >
            <FontAwesomeIcon icon={item.icon} />
          </NavLink>
        ))}
      </div>
    </div>
  )
}
