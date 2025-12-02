/**
 * Currency formatting utilities for cent-based system
 */

export type CurrencyType = 'REAL' | 'PLAY'

// Currency configuration (matches backend config)
const CURRENCY_SMALLEST_UNIT_FACTOR = 100 // 100 cents = $1

/**
 * Format amount from smallest unit (cents) to currency string with 2 decimal places
 *
 * @param amount - Amount in smallest units (e.g., cents)
 * @param symbol - Currency symbol (default: '$')
 * @returns Formatted currency string (e.g., "$20.50")
 *
 * @example
 * formatCurrency(2050) // "$20.50"
 * formatCurrency(100) // "$1.00"
 * formatCurrency(0) // "$0.00"
 * formatCurrency(12345) // "$123.45"
 */
export function formatCurrency(amount: number | bigint, symbol = '$'): string {
  const dollars = Number(amount) / CURRENCY_SMALLEST_UNIT_FACTOR
  return `${symbol}${dollars.toFixed(2)}`
}

export const formatMoney = (amount: number | bigint): string => formatCurrency(amount, '$')

/**
 * Format amount with smart abbreviations for large numbers
 *
 * @param amount - Amount in smallest units (e.g., cents)
 * @param symbol - Currency symbol (default: '$')
 * @returns Formatted currency string with abbreviations (e.g., "$1.5M", "$200K")
 *
 * @example
 * formatCurrencySmart(150000000) // "$1.5M"
 * formatCurrencySmart(20000000) // "$200K"
 * formatCurrencySmart(2050) // "$20.50"
 */
export function formatCurrencySmart(amount: number, symbol = '$'): string {
  const dollars = amount / CURRENCY_SMALLEST_UNIT_FACTOR

  if (dollars >= 1000000) {
    return `${symbol}${(dollars / 1000000).toFixed(1)}M`
  }
  if (dollars >= 1000) {
    return `${symbol}${(dollars / 1000).toFixed(1)}K`
  }
  return formatCurrency(amount, symbol)
}

/**
 * Parse currency input from user (string) to smallest unit (cents)
 *
 * Uses Math.round() for conversion which is appropriate for user input validation.
 * For more complex financial calculations, consider using a dedicated decimal library.
 *
 * @param input - User input string (e.g., "20.5", "20.50", "20")
 * @returns Amount in smallest units (cents), or null if invalid
 *
 * @example
 * parseCurrencyInput("20.5") // 2050
 * parseCurrencyInput("20.50") // 2050
 * parseCurrencyInput("20") // 2000
 * parseCurrencyInput("invalid") // null
 */
export function parseCurrencyInput(input: string): number | null {
  const cleaned = input.trim().replace(/[^0-9.]/g, '')
  const parsed = parseFloat(cleaned)

  if (isNaN(parsed) || parsed < 0) {
    return null
  }

  // Math.round is appropriate here for user input conversion
  // All server-side calculations use integer arithmetic
  return Math.round(parsed * CURRENCY_SMALLEST_UNIT_FACTOR)
}

/**
 * Format chips display (no currency symbol, just numeric value)
 *
 * @param amount - Amount in smallest units
 * @returns Formatted numeric string
 *
 * @example
 * formatChips(2050) // "20.50"
 * formatChips(100000) // "1,000.00"
 */
export function formatChips(amount: number | bigint, withDecimals = true): string {
  const value = Number(amount) / CURRENCY_SMALLEST_UNIT_FACTOR
  return value.toLocaleString('en-US', {
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: withDecimals ? 2 : 0,
  })
}

export function formatPlayMoney(amount: number | bigint, withDecimals = false): string {
  const value = Number(amount)
  return value.toLocaleString('en-US', {
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: withDecimals ? 2 : 0,
  })
}

export function formatByCurrency(
  amount: number | bigint,
  currencyType: CurrencyType,
  opts: { withDecimals?: boolean } = {},
): string {
  if (currencyType === 'PLAY') {
    return formatPlayMoney(amount, opts.withDecimals ?? false)
  }
  return formatMoney(amount)
}

/**
 * Get transaction type display metadata
 *
 * @param type - Transaction type from API
 * @returns Display info with color, icon, and label
 */
export function getTransactionTypeInfo(type: string): {
  color: string
  icon: 'arrow-up' | 'arrow-down' | 'coins' | 'trophy' | 'percent'
  label: string
  isPositive: boolean
} {
  const typeMap: Record<
    string,
    {
      color: string
      icon: 'arrow-up' | 'arrow-down' | 'coins' | 'trophy' | 'percent'
      label: string
      isPositive: boolean
    }
  > = {
    deposit: {
      color: 'var(--color-success)',
      icon: 'arrow-up',
      label: 'Deposit',
      isPositive: true,
    },
    withdrawal: {
      color: 'var(--color-danger)',
      icon: 'arrow-down',
      label: 'Withdrawal',
      isPositive: false,
    },
    buy_in: {
      color: 'var(--color-warning)',
      icon: 'coins',
      label: 'Buy-in',
      isPositive: false,
    },
    cash_out: {
      color: 'var(--color-success)',
      icon: 'coins',
      label: 'Cash Out',
      isPositive: true,
    },
    game_win: {
      color: 'var(--color-success)',
      icon: 'trophy',
      label: 'Game Win',
      isPositive: true,
    },
    game_payout: {
      color: 'var(--color-success)',
      icon: 'trophy',
      label: 'Payout',
      isPositive: true,
    },
    rake: {
      color: 'var(--color-text-muted)',
      icon: 'percent',
      label: 'Rake',
      isPositive: false,
    },
  }

  return (
    typeMap[type] || {
      color: 'var(--color-text-muted)',
      icon: 'coins',
      label: type,
      isPositive: true,
    }
  )
}
