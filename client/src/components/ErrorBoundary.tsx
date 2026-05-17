/**
 * ErrorBoundary.tsx
 * React class-based error boundary.
 * Catches unhandled render/lifecycle errors and shows a recovery UI
 * instead of a blank white screen.
 */

import React from 'react';

interface Props {
    children: React.ReactNode;
    /** Optional custom fallback. Receives the error and a reset callback. */
    fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
    }

    reset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError && this.state.error) {
            if (this.props.fallback) {
                return this.props.fallback(this.state.error, this.reset);
            }

            return (
                <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
                    <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col gap-4 text-center">
                        <span className="text-4xl" aria-hidden="true">⚠️</span>
                        <h1 className="text-lg font-semibold text-white">Something went wrong</h1>
                        <p className="text-sm text-zinc-400 font-mono break-all">
                            {this.state.error.message}
                        </p>
                        <button
                            type="button"
                            onClick={this.reset}
                            className="mt-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold py-2.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
