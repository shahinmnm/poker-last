import { type CurrencyType } from './currency'

export interface TemplateDetails {
  id?: number | string
  table_type?: string
  config?: Record<string, any>
  has_waitlist?: boolean
}

export interface RuleSummary {
  stakesLabel?: string
  stakes?: {
    small?: number
    big?: number
  }
  startingStack?: number
  maxPlayers?: number
  currencyType?: CurrencyType
  tableName?: string | null
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function normalizeConfig(raw?: TemplateDetails | null): Record<string, any> {
  if (!raw) return {}
  const { config } = raw
  if (config && typeof config === 'object') {
    return config
  }
  return {}
}

export function extractRuleSummary(
  template?: TemplateDetails | null,
  fallback?: { max_players?: number; currency_type?: CurrencyType | string; table_name?: string | null },
): RuleSummary {
  const config = normalizeConfig(template)
  const blindsConfig = config.blinds ?? config.stakes ?? null

  let smallStake: number | undefined
  let bigStake: number | undefined

  if (Array.isArray(blindsConfig)) {
    smallStake = toNumber(blindsConfig[0])
    bigStake = toNumber(blindsConfig[1] ?? blindsConfig[0])
  } else if (blindsConfig && typeof blindsConfig === 'object') {
    smallStake = toNumber(
      (blindsConfig as Record<string, unknown>).small ??
        (blindsConfig as Record<string, unknown>).low ??
        (blindsConfig as Record<string, unknown>).min,
    )
    bigStake = toNumber(
      (blindsConfig as Record<string, unknown>).big ??
        (blindsConfig as Record<string, unknown>).high ??
        (blindsConfig as Record<string, unknown>).max,
    )
  }

  const stakesLabel =
    smallStake !== undefined && bigStake !== undefined ? `${smallStake}/${bigStake}` : undefined

  const startingStack =
    toNumber(config.startingStacks?.default ?? config.startingStacks ?? config.starting_stack) ??
    toNumber(config.stack)

  const maxPlayers = toNumber(config.maxPlayers ?? config.max_players ?? fallback?.max_players)

  const currencyRaw =
    (config.currencyType as CurrencyType | string | undefined) ??
    (config.currency_type as CurrencyType | string | undefined) ??
    (fallback?.currency_type as CurrencyType | string | undefined)
  const currencyType = typeof currencyRaw === 'string' ? (currencyRaw.toUpperCase() as CurrencyType) : currencyRaw

  const tableName =
    typeof config.tableName === 'string'
      ? config.tableName
      : typeof config.table_name === 'string'
        ? config.table_name
        : fallback?.table_name ?? null

  return {
    stakesLabel,
    stakes:
      smallStake !== undefined || bigStake !== undefined
        ? { small: smallStake, big: bigStake }
        : undefined,
    startingStack,
    maxPlayers,
    currencyType,
    tableName,
  }
}

export function getTemplateConfig(template?: TemplateDetails | null): Record<string, any> {
  return normalizeConfig(template)
}
