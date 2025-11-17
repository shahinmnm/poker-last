import type { CSSProperties } from 'react'

import { cn } from '../../utils/cn'
import MenuTile, { type MenuTileProps } from '../ui/MenuTile'

export interface MenuTileItem extends MenuTileProps {
  key: string
  style?: CSSProperties
}

interface HomeMenuGridProps {
  items: MenuTileItem[]
}

export function HomeMenuGrid({ items }: HomeMenuGridProps) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-3.5 sm:gap-4" dir="auto">
      {items.map((item, index) => {
        const { key, style, className, ...rest } = item

        return (
          <MenuTile
            key={key}
            {...rest}
            className={cn('animate-tile-in', className)}
            style={{ animationDelay: `${index * 70}ms`, ...(style as CSSProperties) }}
          />
        )
      })}
    </div>
  )
}

export default HomeMenuGrid
