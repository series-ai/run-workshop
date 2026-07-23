import { ReactNode, CSSProperties } from 'react';

interface StackProps {
  /**
   * Stack content
   */
  children: ReactNode;
  /**
   * Spacing between items (in pixels)
   */
  spacing?: number;
  /**
   * Stack direction
   */
  direction?: 'horizontal' | 'vertical';
  /**
   * Alignment of items
   */
  align?: 'start' | 'center' | 'end';
  /**
   * Additional CSS class names
   */
  className?: string;
}

/**
 * Layout component for spacing children evenly
 */
export const Stack: React.FC<StackProps> = ({
  children,
  spacing = 12,
  direction = 'vertical',
  align = 'start',
  className = '',
}) => {
  const style: CSSProperties = {
    display: 'flex',
    flexDirection: direction === 'vertical' ? 'column' : 'row',
    gap: `${spacing}px`,
    alignItems: align === 'center' ? 'center' : align === 'end' ? 'flex-end' : 'flex-start',
  };

  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
};
