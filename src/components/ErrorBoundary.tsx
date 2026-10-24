import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level error boundary that catches unhandled render errors and shows
 * a graceful fallback instead of a blank white screen.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production you'd send this to Sentry / your error reporting service
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReload = () => window.location.reload();

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-deep, #05050f)',
          padding: 24,
          textAlign: 'center',
          fontFamily: 'Space Grotesk, sans-serif',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 64,
              marginBottom: 16,
              filter: 'drop-shadow(0 0 24px rgba(239,68,68,0.4))',
            }}
          >
            💥
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: '#f1f5f9',
              marginBottom: 8,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            Something went wrong
          </h1>
          <p style={{ color: '#94a3b8', marginBottom: 24, maxWidth: 420 }}>
            An unexpected error occurred. Our team has been notified. Please
            reload the page or try again later.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8,
                padding: 16,
                fontSize: 12,
                color: '#fca5a5',
                textAlign: 'left',
                maxWidth: 600,
                overflow: 'auto',
                marginBottom: 24,
              }}
            >
              {this.state.error.stack}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              border: 'none',
              borderRadius: 10,
              padding: '12px 28px',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            🔄 Reload Page
          </button>
        </div>
      </div>
    );
  }
}
