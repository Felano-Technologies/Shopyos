import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-bg p-6">
          <div className="bg-white max-w-md w-full p-10 rounded-[24px] text-center border border-gray-100 shadow-sm">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-3xl font-bold text-red-500">!</span>
            </div>
            <h2 className="text-2xl font-bold text-body mb-2">Something went wrong</h2>
            <p className="text-sm text-subtle mb-6 leading-relaxed">
              An unexpected error occurred. Please try again or contact support if the problem persists.
            </p>
            <button
              onClick={this.handleReset}
              className="bg-navy hover:bg-navy-mid text-white font-bold px-8 py-3 rounded-full text-sm transition-colors shadow-md"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
