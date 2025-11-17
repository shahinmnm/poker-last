import type { ReactNode, SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement>

function IconBase({ children, className = '', ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-6 w-6 ${className}`}
      {...props}
    >
      {children}
    </svg>
  )
}

export function PlayIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 6.8v10.4c0 .52.56.84 1 .58l8-5.2a.68.68 0 0 0 0-1.16l-8-5.2c-.44-.26-1 .06-1 .58Z" />
    </IconBase>
  )
}

export function PrivateIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4.5" y="10" width="15" height="10" rx="2.5" />
      <path d="M8.5 10V8.25A3.75 3.75 0 0 1 12.25 4.5h-.5A3.25 3.25 0 0 1 15 7.75V10" />
      <circle cx="12" cy="14.5" r="1.1" />
      <path d="M12 15.6v1.8" />
    </IconBase>
  )
}

export function JoinIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M15 5.5h2.75A1.75 1.75 0 0 1 19.5 7.25V10" />
      <path d="M9 18.5H6.75A1.75 1.75 0 0 1 5 16.75V14" />
      <path d="M19 5 5 19" />
      <path d="M14.5 19h-4" />
      <path d="M9.5 5h4" />
    </IconBase>
  )
}

export function TablesIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="4.5" width="17" height="14" rx="3" />
      <path d="M7 9.5h10" />
      <path d="M7 14.5h4.5" />
      <path d="M14.5 14.5H17" />
    </IconBase>
  )
}

export function ProfileIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="9.5" r="3" />
      <path d="M6.75 18.75a5.25 5.25 0 0 1 10.5 0" />
    </IconBase>
  )
}

export function SettingsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m9.7 4.5.4-1.3a1 1 0 0 1 1.8 0l.4 1.3a1 1 0 0 0 .93.7h1.35a1 1 0 0 1 .93 1.35l-.43 1.1a1 1 0 0 0 .31 1.1l.96.76a1 1 0 0 1 0 1.58l-.96.76a1 1 0 0 0-.31 1.1l.43 1.1a1 1 0 0 1-.93 1.35h-1.35a1 1 0 0 0-.93.7l-.4 1.3a1 1 0 0 1-1.8 0l-.4-1.3a1 1 0 0 0-.93-.7H7.42a1 1 0 0 1-.93-1.35l.43-1.1a1 1 0 0 0-.31-1.1l-.96-.76a1 1 0 0 1 0-1.58l.96-.76a1 1 0 0 0 .31-1.1l-.43-1.1a1 1 0 0 1 .93-1.35h1.35a1 1 0 0 0 .93-.7Z" />
      <circle cx="12" cy="12" r="2.15" />
    </IconBase>
  )
}

export function PulseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 12h3.2l1.6-3.6 2.4 7.2 2-4 1.2 2h3.6" />
    </IconBase>
  )
}

export function SparkleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3.5 13.4 7l3.6 1.4L13.4 10 12 13.5 10.6 10 7 8.4 10.6 7 12 3.5Z" />
      <path d="M16.75 14 17.5 16l2 .75-2 .75-.75 2-.75-2-2-.75 2-.75.75-2Z" />
      <path d="M7.25 14 8 15.8l1.8.7-1.8.7L7.25 19l-.75-1.8-1.8-.7 1.8-.7.75-1.8Z" />
    </IconBase>
  )
}

export function ShieldIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 4.2 6.5 6.1v5.2a7 7 0 0 0 4.7 6.6l.8.3.8-.3a7 7 0 0 0 4.7-6.6V6.1z" />
      <path d="m10 12.2 1.6 1.6 2.8-3.2" />
    </IconBase>
  )
}

export function LiveIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M4.5 12a7.5 7.5 0 0 1 7.5-7.5" />
      <path d="M19.5 12a7.5 7.5 0 0 1-7.5 7.5" />
    </IconBase>
  )
}

export function WalletIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="6.5" width="16" height="11" rx="2.75" />
      <path d="M16.5 12h2.5v2h-2.5a2 2 0 0 1-2-2 2 2 0 0 1 2-2Z" />
      <circle cx="16.75" cy="12" r=".7" />
    </IconBase>
  )
}

export function HomeLineIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.5 11.5 12 5l7.5 6.5" />
      <path d="M6.5 10.5V19h11v-8.5" />
    </IconBase>
  )
}

export function LobbyIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4.25" y="6" width="15.5" height="12" rx="3" />
      <path d="M7.5 12h9" />
      <path d="M9 8.5h6" />
      <path d="M10 15.5h2.5" />
      <path d="M14.5 15.5H17" />
    </IconBase>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  )
}

export function UserIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="9" r="3" />
      <path d="M7.5 18.5a5 5 0 0 1 9 0" />
    </IconBase>
  )
}
