/**
 * TableMenuCapsule - Professional top capsule menu for poker table
 * 
 * Phase 3 Feature: Redesigned menu button with unified tokens.
 * Clean, consistent spacing, doesn't cover important gameplay elements.
 * 
 * Features:
 * - Connection status indicator with ping animation
 * - Table name and stakes display
 * - Professional submenu with clear items
 * - RTL support
 * - 44px minimum touch targets
 * - Motion-reduce variants
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings, Volume2, HelpCircle, LogOut, ChevronRight, History } from 'lucide-react'
import clsx from 'clsx'

export interface TableMenuCapsuleProps {
  /** Table display name */
  tableName: string
  /** Stakes display string (e.g., "10 / 20") */
  stakesDisplay: string
  /** WebSocket connection status */
  connectionStatus: 'connected' | 'connecting' | 'disconnected'
  /** Callback when leave table is clicked */
  onLeaveTable?: () => void
  /** Callback when recent hands is clicked */
  onRecentHands?: () => void
  /** Whether user can leave the table */
  canLeave?: boolean
  /** Whether leaving is in progress */
  isLeaving?: boolean
  /** Additional CSS class */
  className?: string
}

interface MenuItem {
  id: string
  icon: React.ReactNode
  label: string
  onClick?: () => void
  variant?: 'default' | 'danger'
  disabled?: boolean
  showChevron?: boolean
}

export function TableMenuCapsule({
  tableName,
  stakesDisplay,
  connectionStatus,
  onLeaveTable,
  onRecentHands,
  canLeave = true,
  isLeaving = false,
  className,
}: TableMenuCapsuleProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  
  // Close menu
  const closeMenu = useCallback(() => {
    setIsOpen(false)
  }, [])
  
  // Toggle menu
  const toggleMenu = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])
  
  // Handle click outside
  useEffect(() => {
    if (!isOpen) return
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        closeMenu()
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, closeMenu])
  
  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, closeMenu])
  
  // Menu items
  const menuItems: MenuItem[] = [
    {
      id: 'recent-hands',
      icon: <History size={18} />,
      label: t('table.actions.recentHands', { defaultValue: 'Recent Hands' }),
      onClick: () => {
        onRecentHands?.()
        closeMenu()
      },
      showChevron: true,
    },
    {
      id: 'settings',
      icon: <Settings size={18} />,
      label: t('common.settings', { defaultValue: 'Settings' }),
      onClick: () => {
        // Settings action placeholder
        closeMenu()
      },
      showChevron: true,
    },
    {
      id: 'sound',
      icon: <Volume2 size={18} />,
      label: t('table.menu.sound', { defaultValue: 'Sound' }),
      onClick: () => {
        // Sound toggle placeholder
        closeMenu()
      },
    },
    {
      id: 'rules',
      icon: <HelpCircle size={18} />,
      label: t('table.menu.rules', { defaultValue: 'Game Rules' }),
      onClick: () => {
        // Rules action placeholder
        closeMenu()
      },
      showChevron: true,
    },
  ]
  
  // Leave item (separate for danger styling)
  const leaveItem: MenuItem = {
    id: 'leave',
    icon: <LogOut size={18} />,
    label: isLeaving 
      ? t('table.actions.leaving', { defaultValue: 'Leaving...' })
      : t('table.actions.leave', { defaultValue: 'Leave Table' }),
    onClick: () => {
      onLeaveTable?.()
      closeMenu()
    },
    variant: 'danger',
    disabled: !canLeave || isLeaving,
  }
  
  // Get dot class based on connection status
  const getDotClass = (): string => {
    switch (connectionStatus) {
      case 'connected':
        return 'table-menu-capsule__dot--connected'
      case 'connecting':
        return 'table-menu-capsule__dot--connecting'
      default:
        return 'table-menu-capsule__dot--disconnected'
    }
  }
  
  return (
    <div className={clsx('relative inline-block', className)}>
      {/* Menu Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        className="table-menu-capsule ui-pressable ui-focus-ring"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={t('table.menu.label', { defaultValue: 'Table menu' })}
      >
        {/* Connection status dot */}
        <span className={clsx('table-menu-capsule__dot', getDotClass())} />
        
        {/* Divider */}
        <span className="h-4 w-px bg-[var(--border-3)]" aria-hidden="true" />
        
        {/* Table info */}
        <span className="table-menu-capsule__info">
          <span className="table-menu-capsule__title">{tableName}</span>
          <span className="table-menu-capsule__stakes">{stakesDisplay}</span>
        </span>
        
        {/* Menu icon */}
        <svg 
          className="table-menu-capsule__icon" 
          width="14" 
          height="14" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      
      {/* Backdrop for closing menu */}
      {isOpen && (
        <div 
          className="table-menu-backdrop" 
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}
      
      {/* Submenu */}
      {isOpen && (
        <div
          ref={menuRef}
          className="table-submenu ui-menu-sheet"
          role="menu"
          aria-label={t('table.menu.submenuLabel', { defaultValue: 'Table options' })}
        >
          {/* Regular menu items */}
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="ui-menu-item ui-pressable ui-focus-ring"
              onClick={item.onClick}
              disabled={item.disabled}
            >
              <span className="text-[var(--text-2)]" aria-hidden="true">
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.showChevron && (
                <ChevronRight size={14} className="text-[var(--text-3)]" aria-hidden="true" />
              )}
            </button>
          ))}
          
          {/* Separator */}
          <div className="table-submenu__separator" role="separator" />
          
          {/* Leave item */}
          <button
            type="button"
            role="menuitem"
            className={clsx(
              'ui-menu-item ui-pressable ui-focus-ring',
              'text-[var(--danger)]'
            )}
            onClick={leaveItem.onClick}
            disabled={leaveItem.disabled}
          >
            <span aria-hidden="true">{leaveItem.icon}</span>
            <span className="flex-1">{leaveItem.label}</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default TableMenuCapsule
