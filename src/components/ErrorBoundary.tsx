import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * The top-level error boundary, ported from the reference's `lf` component.
 *
 * Without it a render error blanks the whole app. This catches it, logs it, and
 * offers the same three escapes the reference offers: reload, go home, or try
 * rendering again.
 */

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('FrameXTV Uncaught Error:', error, info);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-950 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
          <div className="flex items-center justify-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-white text-black flex items-center justify-center font-bold font-mono text-sm tracking-tighter border border-zinc-300">
              fX
            </div>
            <span className="font-bold tracking-tight text-white text-lg">
              frame<span className="text-zinc-400">X</span>TV
            </span>
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-white">Something went wrong</h1>
            <p className="text-xs text-zinc-400">
              An unexpected error stopped the page from rendering. Reloading usually fixes it.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3.5 py-2 rounded-lg bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/';
              }}
              className="px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-medium hover:text-white transition-colors cursor-pointer"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-medium hover:text-white transition-colors cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
