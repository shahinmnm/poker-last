import { forwardRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface PotDisplayProps {
  amount: number
}

const PotDisplay = forwardRef<HTMLDivElement, PotDisplayProps>(({ amount }, ref) => {
  const { t } = useTranslation()
  const [isPulsing, setIsPulsing] = useState(false)

  useEffect(() => {
    if (Number.isNaN(amount)) return undefined
    setIsPulsing(true)
    const timer = window.setTimeout(() => setIsPulsing(false), 700)
    return () => window.clearTimeout(timer)
  }, [amount])

  return (
    <div
      ref={ref}
      className={`flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#F2C94C] bg-black/70 shadow-xl shadow-amber-500/30 backdrop-blur-md ${
        isPulsing ? 'animate-[pulse_1s_ease-in-out]' : ''
      }`}
    >
      <div className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-200/80">
          {t('table.potLabel', { defaultValue: 'POT' })}
        </p>
        <p className="text-lg font-semibold text-amber-100">{amount}</p>
      </div>
    </div>
  )
})

PotDisplay.displayName = 'PotDisplay'

export default PotDisplay
