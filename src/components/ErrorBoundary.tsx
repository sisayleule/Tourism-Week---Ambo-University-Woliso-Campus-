/**
 * ErrorBoundary.tsx — Global React error boundary.
 *
 * Catches unhandled render errors and shows a friendly recovery screen
 * instead of a blank white page.  Wraps the entire app in main.tsx.
 *
 * The portal variant (/staff/*) is lazy-loaded; if it throws, only the
 * portal chunk is affected — the public site's own error boundary lower
 * in the tree catches it first.
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional custom fallback rendered instead of the default screen. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error:    Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console in dev; in production you can wire this to a monitoring service.
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (!hasError || !error) return children;

    if (fallback) return fallback(error, this.handleReset);

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F0] dark:bg-[#0B1612] px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                 aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/>
              <line x1="12" x2="12.01" y1="16" y2="16"/>
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
              Something went wrong
            </h1>
            <p className="text-stone-600 dark:text-stone-400 text-sm">
              An unexpected error occurred. Try refreshing the page — if the
              problem persists, please contact the organizing committee.
            </p>
          </div>

          {import.meta.env.DEV && (
            <pre className="text-left text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 overflow-auto text-red-800 dark:text-red-300 max-h-40">
              {error.message}
              {error.stack ? `\n\n${error.stack}` : ''}
            </pre>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-xl bg-[#0F3D2E] text-white font-semibold text-sm hover:bg-[#0A2A20] transition-colors"
            >
              Refresh page
            </button>
            <button
              onClick={this.handleReset}
              className="px-6 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-semibold text-sm hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
