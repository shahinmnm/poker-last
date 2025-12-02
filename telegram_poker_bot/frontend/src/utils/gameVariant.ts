import { useMemo } from 'react'
import { Zap, Layers, Diamond } from 'lucide-react'
import type { GameVariant } from '@/types'

type VariantId = GameVariant | string | undefined | null

export interface GameVariantConfig {
  id: GameVariant
  shortName: string
  fullName: string
  accent: string
  accentSoft: string
  text: string
  icon: React.ComponentType<{ className?: string; size?: number }>
  pulse?: boolean
}

const DEFAULT_CONFIG: GameVariantConfig = {
  id: 'no_limit_texas_holdem',
  shortName: 'NLHE',
  fullName: "Texas Hold'em",
  accent: 'from-sky-400 to-blue-500',
  accentSoft: 'bg-blue-500/10 border-blue-400/30 text-blue-100',
  text: 'text-blue-100',
  icon: Diamond,
  pulse: false,
}

const VARIANT_CONFIG: Record<GameVariant, GameVariantConfig> = {
  no_limit_texas_holdem: DEFAULT_CONFIG,
  no_limit_short_deck_holdem: {
    id: 'no_limit_short_deck_holdem',
    shortName: '6+',
    fullName: 'Short Deck',
    accent: 'from-amber-300 to-orange-500',
    accentSoft: 'bg-amber-500/10 border-amber-400/30 text-amber-100',
    text: 'text-amber-100',
    icon: Zap,
    pulse: true,
  },
  pot_limit_omaha_holdem: {
    id: 'pot_limit_omaha_holdem',
    shortName: 'PLO',
    fullName: 'Omaha',
    accent: 'from-indigo-300 to-purple-500',
    accentSoft: 'bg-purple-500/10 border-purple-400/30 text-purple-100',
    text: 'text-purple-100',
    icon: Layers,
    pulse: false,
  },
}

export function getGameVariantConfig(variant?: VariantId): GameVariantConfig {
  if (variant && variant in VARIANT_CONFIG) {
    return VARIANT_CONFIG[variant as GameVariant]
  }
  return DEFAULT_CONFIG
}

export function useGameVariant(variant?: VariantId): GameVariantConfig {
  return useMemo(() => getGameVariantConfig(variant), [variant])
}
