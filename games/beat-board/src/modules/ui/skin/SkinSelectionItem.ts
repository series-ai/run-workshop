import type { ReactNode } from 'react'
import type { UiSkinIconName } from './types'

export interface SkinSelectionItem {
  id: string
  label: ReactNode
  iconName?: UiSkinIconName
  badgeCount?: number
  disabled?: boolean
}
