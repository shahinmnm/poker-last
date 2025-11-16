import { type ReactNode } from 'react'

import Card from '../ui/Card'
import SectionHeader from '../ui/SectionHeader'

interface LobbySectionProps {
  id?: string
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
}

export function LobbySection({ id, title, subtitle, action, children }: LobbySectionProps) {
  return (
    <Card id={id} padding="md">
      <SectionHeader title={title} subtitle={subtitle} action={action} />
      <div className="mt-[var(--space-lg)] space-y-[var(--space-sm)]">{children}</div>
    </Card>
  )
}

export default LobbySection
