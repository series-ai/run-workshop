import React from "react";

interface GameErrorBoundaryState {
  error: Error | null;
}

/**
 * Last-resort boundary for render-time failures (asset loads throw through
 * Suspense). Without it a failed model load unmounts the whole tree and
 * leaves a blank page with no diagnosis.
 */
export class GameErrorBoundary extends React.Component<
  { children: React.ReactNode },
  GameErrorBoundaryState
> {
  state: GameErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): GameErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error("[StickZone] Fatal render error:", error);
  }

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0f16",
          color: "#f1f5f9",
          fontFamily: "monospace",
          padding: 24,
          zIndex: 9999,
        }}
      >
        <div style={{ maxWidth: 560 }}>
          <h1 style={{ fontSize: 18, margin: "0 0 12px", color: "#ef4444" }}>
            Stick Zone failed to start
          </h1>
          <p style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 12px" }}>
            The game could not load its models or render the first frame. On a
            local run this usually means the run-inkline asset pack is not
            staged (see <code>scripts/stage-inkline-assets.mjs</code>) or the
            asset service is unreachable.
          </p>
          <pre
            style={{
              fontSize: 11,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "#131a26",
              border: "1px solid #28344a",
              borderRadius: 6,
              padding: 12,
              margin: "0 0 16px",
            }}
          >
            {error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#16a34a",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "10px 18px",
              fontFamily: "monospace",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
