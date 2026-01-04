export type CommunityCardSize = 'sm' | 'md' | 'lg'

export function getCommunityCardSize(index: number, totalCards: number): CommunityCardSize {
  if (totalCards <= 1) return 'lg'
  if (totalCards === 2) return 'md'
  if (totalCards === 3) return index === 1 ? 'lg' : 'md'
  if (totalCards === 4) return index === 1 || index === 2 ? 'lg' : 'md'

  const centerIndex = (totalCards - 1) / 2
  const distance = Math.abs(index - centerIndex)

  if (distance === 0) return 'lg'
  if (distance === 1) return 'md'
  return 'sm'
}
