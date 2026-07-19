import { Component, type ReactNode } from "react";

/**
 * ErrorBoundary — contains a render error to the wrapped view instead of letting
 * it blank the whole app (React unmounts the entire tree on an uncaught render
 * throw). Shows a small message + retry. Reset it on navigation with a `key`.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("Perencanaan view error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="empty-note error" style={{ margin: 16 }}>
          <b>Terjadi kesalahan menampilkan halaman ini.</b>
          <div style={{ fontSize: 12, marginTop: 6, opacity: 0.85 }}>{this.state.error.message}</div>
          <button
            type="button"
            className="btn-ghost"
            style={{ marginTop: 10 }}
            onClick={() => this.setState({ error: null })}
          >
            Coba lagi
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
