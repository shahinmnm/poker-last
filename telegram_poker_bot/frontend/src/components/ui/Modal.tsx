import { type ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '../../utils/cn'
import Button from './Button'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  confirmVariant?: 'primary' | 'danger'
  confirmDisabled?: boolean
  className?: string
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  confirmVariant = 'primary',
  confirmDisabled = false,
  className,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-[var(--space-lg)]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        ref={modalRef}
        className={cn(
          'app-card relative z-10 w-full max-w-md p-[var(--space-xl)] sm:p-[calc(var(--space-xl)+var(--space-md))]',
          className
        )}
      >
        <h2 className="text-section-title text-[color:var(--color-text)]">{title}</h2>
        {description && (
          <p className="mt-[var(--space-sm)] text-body text-[color:var(--color-text-muted)]">{description}</p>
        )}
        {children && <div className="mt-[var(--space-lg)]">{children}</div>}
        {(confirmLabel || cancelLabel) && (
          <div className="mt-[var(--space-xl)] flex gap-[var(--space-md)]">
            {cancelLabel && (
              <Button variant="secondary" size="md" onClick={onClose} block>
                {cancelLabel}
              </Button>
            )}
            {confirmLabel && onConfirm && (
              <Button
                variant={confirmVariant}
                size="md"
                onClick={onConfirm}
                disabled={confirmDisabled}
                block
              >
                {confirmLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export default Modal
