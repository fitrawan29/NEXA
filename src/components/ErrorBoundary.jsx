import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 h-[100dvh] w-full flex items-center justify-center bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-lg border border-rose-200 dark:border-rose-800 max-w-full">
            <h1 className="text-xl font-bold mb-2">Something went wrong.</h1>
            <pre className="text-xs overflow-auto font-mono bg-rose-50 dark:bg-rose-950/50 p-3 rounded">{this.state.error ? this.state.error.toString() : 'Unknown error'}</pre>
            <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-rose-600 text-white rounded hover:bg-rose-700 font-bold text-sm">Refresh Page</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
