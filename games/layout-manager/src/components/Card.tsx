import { ReactNode } from 'react';

interface CardProps {
  /**
   * Card title
   */
  title?: string;
  /**
   * Card description
   */
  description?: string;
  /**
   * Card content
   */
  children: ReactNode;
  /**
   * Additional CSS class names
   */
  className?: string;
}

/**
 * Reusable card component for content sections
 */
export const Card: React.FC<CardProps> = ({ title, description, children, className = '' }) => {
  return (
    <div className={`card ${className}`}>
      {title && <h2>{title}</h2>}
      {description && <p>{description}</p>}
      {children}
    </div>
  );
};
