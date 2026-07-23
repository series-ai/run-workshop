import { ReactNode, ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary';
type ButtonSize = 'normal' | 'large';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Button visual style
   */
  variant?: ButtonVariant;
  /**
   * Button size
   */
  size?: ButtonSize;
  /**
   * Button content
   */
  children: ReactNode;
}

/**
 * Reusable button component with variants and sizes
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'normal',
  children,
  className = '',
  ...props
}) => {
  const variantClass = `btn-${variant}`;
  const sizeClass = size === 'large' ? 'btn-large' : '';
  const classes = `${variantClass} ${sizeClass} ${className}`.trim();

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
};
