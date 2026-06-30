import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button as SemanticButton } from '@modules/ui/skin'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
type ButtonSize = 'normal' | 'large' | 'icon' | 'sm'

const BUTTON_SIZE_CLASSES: Record<ButtonSize, string> = {
  normal: '',
  large: 'w-full',
  icon: 'min-h-[52px] min-w-[52px] px-0',
  sm: 'min-h-[40px] px-4 text-sm',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'normal', type = 'button', ...props }, ref) => {
    const resolvedClassName = cn(BUTTON_SIZE_CLASSES[size], className)
    const commonProps = {
      ...props,
      className: resolvedClassName,
      ref,
      type,
    }

    switch (variant) {
      case 'secondary':
        return <SemanticButton.Secondary {...commonProps} />
      case 'ghost':
        return <SemanticButton.Ghost {...commonProps} />
      case 'destructive':
        return <SemanticButton.Secondary {...commonProps} tone="red" />
      default:
        return <SemanticButton.Primary {...commonProps} />
    }
  },
)
Button.displayName = 'Button'
