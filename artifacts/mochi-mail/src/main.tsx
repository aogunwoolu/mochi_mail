import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initPostHog, trackError } from "./lib/posthog";

initPostHog();

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    trackError(error, { component_stack: info.componentStack ?? "" });
  }

  override render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100svh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            fontFamily: "Inter, sans-serif",
            background: "radial-gradient(circle at top left, rgba(255,255,255,0.95), rgba(255,214,236,0.92) 42%, rgba(255,246,251,0.92) 100%)",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.85)",
              border: "1px solid rgba(255,107,157,0.2)",
              borderRadius: 24,
              padding: "2rem",
              maxWidth: 420,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>💌</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "#1a1a2e" }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: 13, color: "#6b6b80", marginBottom: 16 }}>
              {this.state.error.message}
            </p>
            <button
              onClick={() => globalThis.location.reload()}
              style={{
                background: "linear-gradient(135deg, #ff6b9d, #a78bfa)",
                color: "white",
                border: "none",
                borderRadius: 12,
                padding: "0.5rem 1.25rem",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
