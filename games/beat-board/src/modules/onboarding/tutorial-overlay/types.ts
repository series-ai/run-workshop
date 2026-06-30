export interface TutorialStep {
  id: string
  targetElementId?: string
  message: string
  arrowDirection?: 'up' | 'down' | 'left' | 'right'
  clickToDismiss?: boolean
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right'
  tooltipAlign?: 'left' | 'center' | 'right'
  /** If false, dismiss() is a no-op on this step (must advance/complete instead) */
  dismissible?: boolean
  /** Character ID — when set, render avatar + speech bubble instead of plain tooltip */
  character?: string
  /** Hint key for contextual help */
  hint?: string
}

export interface TutorialState {
  isActive: boolean
  currentStep: TutorialStep | null
  stepIndex: number
  totalSteps: number
}
