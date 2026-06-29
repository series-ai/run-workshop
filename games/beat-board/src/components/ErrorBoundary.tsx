import { Component, ReactNode } from 'react';
import type { ErrorInfo } from 'react';
import RundotAPI from '@series-inc/rundot-game-sdk/api';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary to catch and display errors gracefully
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    RundotAPI.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="flex h-dvh w-full flex-col items-center justify-center p-[var(--spacing-xl)] text-center text-[var(--ui-text-primary)] [background:var(--ui-page-bg)]"
          data-testid="app-runtime-error"
          role="alert"
        >
          <div className="mb-[var(--spacing-sm)] flex h-16 w-16 items-center justify-center rounded-full border border-[var(--ui-panel-card-border)] text-[32px] font-black">
            !
          </div>
          <h2 className="mb-[var(--spacing-xs)] text-[var(--font-xl)]">Something went wrong</h2>
          <p className="mb-[var(--spacing-md)] max-w-[420px] text-[var(--font-md)] text-[var(--ui-text-muted)]">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <Button variant="primary" size="large" onClick={this.handleReload}>
            Reload App
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
