"use client";

import { Component, ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

/**
 * Global error boundary — prevents blank screens.
 * Shows a friendly recovery message instead of a crash.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("ErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <div className="text-5xl mb-4">😕</div>
            <h2 className="text-xl font-semibold text-[#FFD166] mb-2">
              Something went wrong
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Please try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary text-sm inline-block"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}