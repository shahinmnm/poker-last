import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUpWideShort, faCheck } from '@fortawesome/free-solid-svg-icons'

import { cn } from '../../utils/cn'

interface SortOption<T extends string> {
  value: T
  label: string
}

interface SortMenuProps<T extends string> {
  value: T
  options: Array<SortOption<T>>
  onChange: (value: T) => void
  label: string
}

export default function SortMenu<T extends string>({ value, options, onChange, label }: SortMenuProps<T>) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--border-2)] bg-[var(--surface-2)] px-4 text-xs font-semibold text-[var(--text-2)] transition hover:text-[var(--text-1)]"
        aria-expanded={open}
      >
        <FontAwesomeIcon icon={faArrowUpWideShort} />
        {label}
      </button>
      {open && (
        <div
          className="absolute mt-2 w-52 rounded-2xl border border-[var(--border-2)] bg-[var(--surface-1)] p-2 shadow-[0_14px_30px_rgba(0,0,0,0.22)]"
          style={{ insetInlineEnd: 0 }}
        >
          {options.map((option) => {
            const isActive = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={cn(
                  'flex min-h-[44px] w-full items-center justify-between rounded-xl px-3 py-3 text-xs font-medium transition',
                  isActive
                    ? 'bg-[var(--surface-2)] text-[var(--text-1)]'
                    : 'text-[var(--text-3)] hover:text-[var(--text-1)]'
                )}
                style={{ textAlign: 'start' }}
              >
                <span dir="auto">{option.label}</span>
                {isActive && <FontAwesomeIcon icon={faCheck} className="text-[var(--text-1)]" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
