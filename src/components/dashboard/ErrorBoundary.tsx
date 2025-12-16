'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

class DashboardErrorBoundary extends Component<Props, State> {
  private retryTimeout: NodeJS.Timeout | null = null;

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    retryCount: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Dashboard Error:', error, errorInfo);
    this.setState({ errorInfo });

    // Auto-retry up to 3 times with exponential backoff
    if (this.state.retryCount < 3) {
      const delay = Math.pow(2, this.state.retryCount) * 1000; // 1s, 2s, 4s
      this.retryTimeout = setTimeout(() => {
        this.handleRetry();
      }, delay);
    }
  }

  public componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  private handleRetry = () => {
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
    }));
  };

  private handleHardRefresh = () => {
    // Clear any cached state
    try {
      // Clear React Query cache if exists
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (e) {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      const { retryCount } = this.state;
      const isAutoRetrying = retryCount < 3;

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
            <div className="text-6xl mb-4">
              {isAutoRetrying ? '🔄' : '⚠️'}
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {isAutoRetrying ? 'Memuat ulang...' : 'Terjadi Kesalahan'}
            </h2>
            <p className="text-gray-600 mb-6">
              {isAutoRetrying
                ? `Mencoba koneksi ulang (${retryCount + 1}/3)...`
                : 'Halaman mengalami masalah. Silakan coba muat ulang.'}
            </p>

            {!isAutoRetrying && (
              <div className="space-y-3">
                <button
                  onClick={this.handleRetry}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Coba Lagi
                </button>
                <button
                  onClick={this.handleHardRefresh}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Muat Ulang Halaman
                </button>
              </div>
            )}

            {isAutoRetrying && (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-6 text-left bg-red-50 p-4 rounded-md">
                <p className="text-sm font-mono text-red-800 break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default DashboardErrorBoundary;
