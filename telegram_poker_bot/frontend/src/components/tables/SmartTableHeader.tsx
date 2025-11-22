import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRightFromBracket, faLink, faUser } from '@fortawesome/free-solid-svg-icons'

interface SmartTableHeaderProps {
  tableId: number | string
  status?: string
  smallBlind: number
  bigBlind: number
  hostName?: string | null
  createdAt?: string | null
  inviteUrl?: string
  onLeave?: () => void
}

const formatUptime = (createdAt?: string | null, now = new Date()) => {
  if (!createdAt) return '00:00'
  const start = new Date(createdAt)
  const diffMs = Math.max(0, now.getTime() - start.getTime())
  const totalMinutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export default function SmartTableHeader({
  tableId,
  status,
  smallBlind,
  bigBlind,
  hostName,
  createdAt,
  inviteUrl,
  onLeave,
}: SmartTableHeaderProps) {
  const [expanded, setExpanded] = useState(false)
  const [now, setNow] = useState(new Date())
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000 * 30)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setExpanded(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const uptime = useMemo(() => formatUptime(createdAt, now), [createdAt, now])
  const inviteLink = useMemo(() => inviteUrl || window.location.href, [inviteUrl])

  const statusColor = (status || '').toLowerCase() === 'active' ? 'bg-emerald-400' : 'bg-red-400'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
    } catch (err) {
      console.error('Failed to copy invite link', err)
    }
  }

  return (
    <div className="absolute left-1/2 top-4 -translate-x-1/2 z-50 flex justify-center" ref={containerRef}>
      <div
        className={`flex flex-col items-center transition-all duration-300 ease-out ${expanded ? 'w-[360px]' : 'w-auto'}`}
      >
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={`flex items-center gap-2 ${expanded ? 'rounded-t-3xl' : 'rounded-full'} bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 text-white shadow-lg transition-all duration-300`}
        >
          <span className={`h-2 w-2 rounded-full ${statusColor}`} aria-hidden />
          <span className="text-sm font-semibold">Table #{tableId}</span>
        </button>

        <div
          className={`overflow-hidden bg-black/70 text-white border border-white/10 backdrop-blur-xl shadow-xl rounded-b-3xl transition-all duration-300 ${expanded ? 'max-h-[320px] opacity-100' : 'max-h-0 opacity-0'} w-full`}
        >
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">Blinds</span>
              <span className="font-semibold">${smallBlind}/${bigBlind}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">Host</span>
              <span className="flex items-center gap-2 font-semibold">
                <FontAwesomeIcon icon={faUser} className="text-white/60" />
                {hostName || 'Unknown'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">Uptime</span>
              <span className="font-semibold">{uptime}</span>
            </div>

            <div className="flex items-center justify-between pt-2 gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 px-3 py-3 transition-colors"
              >
                <FontAwesomeIcon icon={faLink} />
                <span className="text-sm font-semibold">Copy Invite</span>
              </button>
              <button
                type="button"
                onClick={onLeave}
                className="flex items-center justify-center gap-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 px-4 py-3 text-red-200 transition-colors"
              >
                <FontAwesomeIcon icon={faArrowRightFromBracket} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
