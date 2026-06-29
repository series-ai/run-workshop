import type { HTMLAttributes, ReactNode } from 'react'
import { joinClassName } from './theme/classNames'

export interface SkinListRowProps extends HTMLAttributes<HTMLDivElement> {
  rank?: ReactNode
  avatar?: ReactNode
  name?: ReactNode
  score?: ReactNode
  highlight?: 'self' | undefined
  children?: ReactNode
}

export function SkinListRow({ rank, avatar, name, score, highlight, className, children, ...rest }: SkinListRowProps) {
  return (
    <div
      {...rest}
      className={joinClassName('ui-list-row', className)}
      data-highlight={highlight ?? undefined}
      data-ui-skin-role="list.row"
    >
      <div className="ui-list-row__rank" data-ui-slot="rank">{rank}</div>
      <div className="ui-list-row__avatar" data-ui-slot="avatar">{avatar}</div>
      <div className="ui-list-row__name" data-ui-slot="name">
        <div className="ui-list-row__name-content">{name}</div>
      </div>
      <div className="ui-list-row__score" data-ui-slot="score">{score}</div>
      {children}
    </div>
  )
}
