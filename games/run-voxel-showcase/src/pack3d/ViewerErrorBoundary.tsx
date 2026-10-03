/**
 * Shows a readable message when a 3D surface fails: no WebGL, a corrupt GLB,
 * or a contract guard (AssetContractError / RigMismatchError). Only the
 * wrapped surface fails; the rest of the app keeps rendering.
 */
import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Changing this clears a caught error (e.g. a new model id). */
  resetKey?: string
}

interface State {
  error: Error | null
  resetKey?: string
}

export class ViewerErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const guard = error.name === 'AssetContractError' || error.name === 'RigMismatchError'
    return (
      <div className="viewer-error" role="alert" data-error-name={error.name}>
        <strong>{guard ? error.name : 'The 3D viewer failed.'}</strong>
        <span>{error.message}</span>
        {!guard && <span className="viewer-error-hint">This usually means WebGL is unavailable or the file is broken.</span>}
      </div>
    )
  }
}
