/**
 * Catches render failures in the 3D canvases — WebGL unavailable in a
 * headless browser, a corrupt GLB, an unsupported GPU feature — and shows a
 * readable message instead of blanking the whole app.
 */
import { Component, type ReactNode } from 'react'

interface ViewerErrorBoundaryProps {
  children: ReactNode
}

interface ViewerErrorBoundaryState {
  error: Error | null
}

export class ViewerErrorBoundary extends Component<
  ViewerErrorBoundaryProps,
  ViewerErrorBoundaryState
> {
  state: ViewerErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ViewerErrorBoundaryState {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="viewer-error" role="alert">
          <strong>The 3D viewer failed to start.</strong>
          <span>{this.state.error.message}</span>
          <span className="viewer-error-hint">
            This usually means WebGL is unavailable in this browser.
          </span>
        </div>
      )
    }
    return this.props.children
  }
}
