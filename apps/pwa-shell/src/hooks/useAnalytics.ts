/**
 * React Hooks for Grahmos Analytics and Telemetry
 * Provides easy-to-use hooks for tracking user interactions and application metrics
 */

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import telemetry from '@/lib/telemetry';

/**
 * Hook to automatically track page views
 */
export function usePageTracking() {
  const router = useRouter();
  const lastPathRef = useRef<string>('');

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      // Avoid duplicate tracking for the same page
      if (lastPathRef.current !== url) {
        telemetry.recordPageView(url, {
          'page.previous': lastPathRef.current,
          'page.timestamp': Date.now(),
        });
        lastPathRef.current = url;
      }
    };

    // Track initial page load
    if (router.asPath && lastPathRef.current !== router.asPath) {
      handleRouteChange(router.asPath);
    }

    router.events.on('routeChangeComplete', handleRouteChange);
    
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);
}

/**
 * Hook to track search operations
 */
export function useSearchTracking() {
  const trackSearch = useCallback((
    query: string,
    results: number,
    duration: number,
    additionalAttributes: Record<string, any> = {}
  ) => {
    const startTime = performance.now();
    
    telemetry.recordSearch(query, results, duration, additionalAttributes.source);
    
    // Additional search analytics
    telemetry.recordMetric('search_analytics', {
      'search.query_length': query.length,
      'search.results_count': results,
      'search.execution_time': duration,
      'search.timestamp': Date.now(),
      ...additionalAttributes,
    });
  }, []);

  return trackSearch;
}

/**
 * Hook to track AI assistant interactions
 */
export function useAssistantTracking() {
  const trackInteraction = useCallback((
    type: 'question' | 'command' | 'feedback',
    duration: number,
    success: boolean,
    additionalData: {
      model?: string;
      responseLength?: number;
      errorType?: string;
      userSatisfaction?: number;
    } = {}
  ) => {
    telemetry.recordAssistantInteraction(type, duration, success, additionalData.model);
    
    // Enhanced assistant analytics
    telemetry.recordMetric('assistant_analytics', {
      'assistant.interaction_type': type,
      'assistant.success': success,
      'assistant.duration': duration,
      'assistant.response_length': additionalData.responseLength || 0,
      'assistant.model': additionalData.model || 'unknown',
      'assistant.timestamp': Date.now(),
      ...(additionalData.errorType && { 'assistant.error_type': additionalData.errorType }),
      ...(additionalData.userSatisfaction && { 'assistant.user_satisfaction': additionalData.userSatisfaction }),
    });
  }, []);

  return trackInteraction;
}

/**
 * Hook to track user errors and exceptions
 */
export function useErrorTracking() {
  const trackError = useCallback((
    error: Error,
    context: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    additionalData: Record<string, any> = {}
  ) => {
    telemetry.recordError(error, context, severity);
    
    // Enhanced error analytics
    telemetry.recordMetric('error_analytics', {
      'error.type': error.name,
      'error.context': context,
      'error.severity': severity,
      'error.timestamp': Date.now(),
      'error.stack_trace_length': error.stack?.length || 0,
      ...additionalData,
    });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${severity.toUpperCase()}] ${context}:`, error);
    }
  }, []);

  return trackError;
}

/**
 * Hook to track user engagement metrics
 */
export function useEngagementTracking() {
  const sessionStartTime = useRef<number>(Date.now());
  const lastActivityTime = useRef<number>(Date.now());
  const clickCount = useRef<number>(0);
  const scrollDepth = useRef<number>(0);

  useEffect(() => {
    let engagementTimer: NodeJS.Timeout;

    const updateActivity = () => {
      lastActivityTime.current = Date.now();
    };

    const trackClick = () => {
      clickCount.current++;
      updateActivity();
    };

    const trackScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollPercent = Math.round((scrollTop + windowHeight) / documentHeight * 100);
      
      scrollDepth.current = Math.max(scrollDepth.current, scrollPercent);
      updateActivity();
    };

    // Track user activities
    document.addEventListener('click', trackClick);
    document.addEventListener('scroll', trackScroll);
    document.addEventListener('mousemove', updateActivity);
    document.addEventListener('keypress', updateActivity);

    // Periodic engagement reporting
    const reportEngagement = () => {
      const sessionDuration = Date.now() - sessionStartTime.current;
      const timeSinceActivity = Date.now() - lastActivityTime.current;
      
      // Only report if user is still active (activity within last 5 minutes)
      if (timeSinceActivity < 5 * 60 * 1000) {
        telemetry.recordMetric('user_engagement', {
          'engagement.session_duration': sessionDuration,
          'engagement.clicks': clickCount.current,
          'engagement.scroll_depth': scrollDepth.current,
          'engagement.time_since_activity': timeSinceActivity,
          'engagement.page': window.location.pathname,
        });
      }
    };

    engagementTimer = setInterval(reportEngagement, 30000); // Report every 30 seconds

    return () => {
      document.removeEventListener('click', trackClick);
      document.removeEventListener('scroll', trackScroll);
      document.removeEventListener('mousemove', updateActivity);
      document.removeEventListener('keypress', updateActivity);
      
      if (engagementTimer) {
        clearInterval(engagementTimer);
      }
      
      // Final engagement report
      reportEngagement();
    };
  }, []);

  const trackCustomEngagement = useCallback((
    eventName: string,
    properties: Record<string, any> = {}
  ) => {
    telemetry.recordMetric(`engagement_${eventName}`, {
      'engagement.event': eventName,
      'engagement.timestamp': Date.now(),
      'engagement.page': window.location.pathname,
      ...properties,
    });
  }, []);

  return trackCustomEngagement;
}

/**
 * Hook to track performance metrics
 */
export function usePerformanceTracking() {
  const trackOperation = useCallback((
    operationName: string,
    duration: number,
    success: boolean,
    additionalMetrics: Record<string, any> = {}
  ) => {
    telemetry.recordMetric('performance', {
      'performance.operation': operationName,
      'performance.duration': duration,
      'performance.success': success,
      'performance.timestamp': Date.now(),
      ...additionalMetrics,
    });
  }, []);

  const trackAsyncOperation = useCallback(async <T>(
    operationName: string,
    operation: () => Promise<T>,
    additionalMetrics: Record<string, any> = {}
  ): Promise<T> => {
    const startTime = performance.now();
    const span = telemetry.startSpan(operationName, {
      'operation.type': 'async',
      ...additionalMetrics,
    });

    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      
      trackOperation(operationName, duration, true, additionalMetrics);
      span?.setStatus({ code: 1 }); // OK
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      trackOperation(operationName, duration, false, {
        ...additionalMetrics,
        'error.message': error instanceof Error ? error.message : 'Unknown error',
      });
      
      span?.setStatus({ 
        code: 2, // ERROR
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    } finally {
      span?.end();
    }
  }, [trackOperation]);

  return { trackOperation, trackAsyncOperation };
}

/**
 * Hook to track feature usage and adoption
 */
export function useFeatureTracking() {
  const trackFeatureUsage = useCallback((
    featureName: string,
    action: string,
    properties: Record<string, any> = {}
  ) => {
    telemetry.recordMetric('feature_usage', {
      'feature.name': featureName,
      'feature.action': action,
      'feature.timestamp': Date.now(),
      'feature.page': window.location.pathname,
      ...properties,
    });
  }, []);

  const trackFeatureDiscovery = useCallback((
    featureName: string,
    discoveryMethod: 'menu' | 'search' | 'recommendation' | 'tooltip' | 'other',
    properties: Record<string, any> = {}
  ) => {
    telemetry.recordMetric('feature_discovery', {
      'feature.name': featureName,
      'feature.discovery_method': discoveryMethod,
      'feature.timestamp': Date.now(),
      ...properties,
    });
  }, []);

  return { trackFeatureUsage, trackFeatureDiscovery };
}

/**
 * Hook to set user context for telemetry
 */
export function useUserContext() {
  const setUserContext = useCallback((
    userId: string,
    attributes: Record<string, any> = {}
  ) => {
    telemetry.setUserContext(userId, {
      'user.authenticated': true,
      'user.context_set_at': Date.now(),
      ...attributes,
    });
  }, []);

  const clearUserContext = useCallback(() => {
    telemetry.setUserContext('anonymous', {
      'user.authenticated': false,
      'user.context_cleared_at': Date.now(),
    });
  }, []);

  return { setUserContext, clearUserContext };
}

/**
 * Combined analytics hook that provides all tracking capabilities
 */
export function useAnalytics() {
  const trackSearch = useSearchTracking();
  const trackAssistant = useAssistantTracking();
  const trackError = useErrorTracking();
  const trackEngagement = useEngagementTracking();
  const { trackOperation, trackAsyncOperation } = usePerformanceTracking();
  const { trackFeatureUsage, trackFeatureDiscovery } = useFeatureTracking();
  const { setUserContext, clearUserContext } = useUserContext();

  return {
    // Search tracking
    trackSearch,
    
    // Assistant tracking
    trackAssistant,
    
    // Error tracking
    trackError,
    
    // Engagement tracking
    trackEngagement,
    
    // Performance tracking
    trackOperation,
    trackAsyncOperation,
    
    // Feature tracking
    trackFeatureUsage,
    trackFeatureDiscovery,
    
    // User context
    setUserContext,
    clearUserContext,
    
    // Custom metrics
    trackCustomMetric: (name: string, attributes: Record<string, any>, value?: number) => {
      telemetry.recordMetric(name, attributes, value);
    },
  };
}
