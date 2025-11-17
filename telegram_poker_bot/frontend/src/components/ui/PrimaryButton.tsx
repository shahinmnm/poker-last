import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../utils/cn'

type PrimaryTone = 'primary' | 'secondary'

export interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: PrimaryTone
  block?: boolean
}

export function PrimaryButton({ className, children, tone = 'primary', block, ...rest }: PrimaryButtonProps) {
  const isPrimary = tone === 'primary'
  return (
    <button
      className={cn(
        'relative isolate overflow-hidden rounded-full px-6 py-3.5 text-base font-semibold transition active:scale-95',
        block && 'w-full',
        isPrimary
          ? 'bg-[#fdfdfd] text-[#0a0f1a] shadow-[0_10px_30px_rgba(0,0,0,0.6),0_18px_46px_rgba(73,220,122,0.25)]'
          : 'border border-white/10 bg-[rgba(255,255,255,0.06)] text-[color:var(--color-text)] shadow-[0_10px_28px_rgba(0,0,0,0.55)]',
        className,
      )}
      {...rest}
    >
      {isPrimary && (
        <span
          className="pointer-events-none absolute inset-x-6 bottom-[-40%] h-full rounded-full bg-[radial-gradient(circle_at_center,rgba(73,220,122,0.25),transparent_58%)] blur-2xl"
          aria-hidden
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  )
}

export default PrimaryButton
