export function formatChips(amount: number | bigint | null | undefined): string {
  const n = Number(amount ?? 0)
  const abs = Math.abs(n)

  if (abs >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`
  }

  if (abs >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  }

  if (abs >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(n)
}
