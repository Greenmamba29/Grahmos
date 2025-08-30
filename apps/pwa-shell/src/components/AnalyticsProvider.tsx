'use client';

/**
 * Analytics Provider Component
 * Initializes telemetry and provides analytics context throughout the app
 */

import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import telemetry from '@/lib/telemetry';

interface AnalyticsContextValue {
  telemetryInitialized: boolean;
}

const AnalyticsContext = createContext<AnalyticsContextValue>({
  telemetryInitialized: false,
});

export const useAnalyticsContext = () => useContext(AnalyticsContext);

interface AnalyticsProviderProps {
  children: ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const pathname = usePathname();
  const [telemetryInitialized, setTelemetryInitialized] = React.useState(false);

  useEffect(() => {
    // Initialize telemetry
    try {
      // Telemetry is auto-initialized, just mark as ready
      setTelemetryInitialized(true);
      
      console.log('Analytics Provider initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Analytics Provider:', error);
    }

    // Cleanup on unmount
    return () => {
      telemetry.flush().catch(console.error);
    };
  }, []);

  // Track pathname changes
  useEffect(() => {
    if (telemetryInitialized && pathname) {
      telemetry.recordPageView(pathname, {
        'page.timestamp': Date.now(),
        'page.load_type': 'navigation',
      });
    }
  }, [pathname, telemetryInitialized]);

  // Error boundary for analytics
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (telemetryInitialized) {
        const error = new Error(event.message);
        error.name = 'UnhandledError';
        error.stack = event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined;
        
        // Set additional attributes on the error object
        (error as any).filename = event.filename;
        (error as any).lineno = event.lineno;
        (error as any).colno = event.colno;
        
        telemetry.recordError(error, 'global_error_handler', 'high');
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (telemetryInitialized) {
        const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
        error.name = 'UnhandledPromiseRejection';
        
        telemetry.recordError(error, 'global_promise_rejection', 'high');
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [telemetryInitialized]);

  const contextValue: AnalyticsContextValue = {
    telemetryInitialized,
  };

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
    </AnalyticsContext.Provider>
  );
}
