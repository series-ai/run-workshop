import type { HTMLAttributes } from 'react'
import { SkinIcon } from './SkinIcon'
import { joinClassName } from './theme/classNames'

export interface SkinRankBadgeProps extends HTMLAttributes<HTMLDivElement> {
  rank: number
}

export function SkinRankBadge({ rank, className, ...rest }: SkinRankBadgeProps) {
  const isTop3 = rank >= 1 && rank <= 3
  const iconName = rank === 1 ? 'rank-1' as const : rank === 2 ? 'rank-2' as const : rank === 3 ? 'rank-3' as const : undefined

  return (
    <div
      {...rest}
      className={joinClassName('ui-rank-badge', className)}
      data-rank={rank}
      data-top3={isTop3 ? 'true' : undefined}
      data-ui-skin-role="list.rankBadge"
    >
      {iconName ? (
        <SkinIcon className="ui-rank-badge__icon" name={iconName} size={28} />
      ) : (
        <span className="ui-rank-badge__number">{rank}</span>
      )}
    </div>
  )
}
