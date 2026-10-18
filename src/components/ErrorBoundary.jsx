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
    const msg = (error?.message || error?.name || String(error || '')).toLowerCase();
    if (
      msg.includes('failed to fetch dynamically imported module') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('failed to load module script') ||
      msg.includes('loading chunk') ||
      msg.includes('chunkloaderror') ||
      msg.includes('importing a module script failed')
    ) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        window.addEventListener('online', () => window.location.reload(), { once: true });
        return;
      }
      const CHUNK_RELOAD_KEY = 'nexa_chunk_retry_timestamp';
      const now = Date.now();
      try {
        const last = parseInt(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0', 10);
        if (!last || now - last >= 10000) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
          window.location.reload();
        }
      } catch {
        const hasRetried = typeof window !== 'undefined' && /[?&]chunk_retry=/.test(window.location.search);
        if (!hasRetried && typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('chunk_retry', String(now));
          window.location.replace(url.href);
        }
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800">
          <h1 className="text-xl font-bold mb-2">Something went wrong.</h1>
          <pre className="text-xs overflow-auto font-mono">{this.state.error ? this.state.error.toString() : 'Unknown error'}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

if (typeof window !== 'undefined') {
  window.ErrorBoundary = ErrorBoundary;
}

export default ErrorBoundary;
