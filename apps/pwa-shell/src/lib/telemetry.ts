/**
 * Simplified Telemetry for Grahmos PWA Shell
 * Basic browser-side analytics and logging
 */

// Application configuration
const APP_NAME = 'grahmos-pwa';
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '2.0.0';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

// Telemetry configuration
interface TelemetryConfig {
  enabled: boolean;
  enableAnalytics: boolean;
  enablePerformanceTracking: boolean;
  enableErrorTracking: boolean;
  sampleRate: number;
}

const defaultConfig: TelemetryConfig = {
  enabled: process.env.NEXT_PUBLIC_TELEMETRY_ENABLED !== 'false',
  enableAnalytics: true,
  enablePerformanceTracking: true,
  enableErrorTracking: true,
  sampleRate: parseFloat(process.env.NEXT_PUBLIC_TELEMETRY_SAMPLE_RATE || '0.1'),
};

class PWATelemetry {
  private isInitialized = false;
  private config: TelemetryConfig;
  private metrics: Record<string, any> = {};
  
  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    
    if (this.config.enabled && typeof window !== 'undefined') {
      this.initialize();
    }
  }
  
  private initialize() {
    try {
      // Initialize basic browser analytics
      this.setupErrorTracking();
      this.setupPerformanceTracking();
      
      this.isInitialized = true;
      console.log(`${APP_NAME} telemetry initialized successfully`);
    } catch (error) {
      console.error(`Failed to initialize ${APP_NAME} telemetry:`, error);
    }
  }
  
  private setupErrorTracking() {
    if (!this.config.enableErrorTracking) return;
    
    window.addEventListener('error', (event) => {
      this.recordError(event.error, 'javascript', 'medium', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      this.recordError(new Error(event.reason), 'promise', 'high', {
        reason: event.reason,
      });
    });
  }
  
  private setupPerformanceTracking() {
    if (!this.config.enablePerformanceTracking) return;
    
    // Track page load performance
    if ('performance' in window && 'getEntriesByType' in window.performance) {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          this.recordPerformance('page_load', {
            loadTime: navigation.loadEventEnd - navigation.loadEventStart,
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            firstByte: navigation.responseStart - navigation.requestStart,
          });
        }
      }, 1000);
    }
  }
  
  // Public API methods
  
  /**
   * Record page views
   */
  recordPageView(path: string, metadata: Record<string, any> = {}) {
    if (!this.isInitialized || !this.config.enableAnalytics) return;
    
    console.log(`Page View: ${path}`, metadata);
    
    this.metrics['page_views'] = (this.metrics['page_views'] || 0) + 1;
    this.metrics[`page_${path}`] = (this.metrics[`page_${path}`] || 0) + 1;
  }
  
  /**
   * Record search queries
   */
  recordSearch(query: string, results: number, duration: number, source?: string) {
    if (!this.isInitialized || !this.config.enableAnalytics) return;
    
    console.log(`Search: "${query}" - ${results} results (${duration}ms) from ${source || 'unknown'}`);
    
    this.metrics['searches'] = (this.metrics['searches'] || 0) + 1;
    this.metrics['search_results_total'] = (this.metrics['search_results_total'] || 0) + results;
  }
  
  /**
   * Record assistant interactions
   */
  recordAssistantInteraction(type: string, duration: number, success: boolean, model?: string) {
    if (!this.isInitialized || !this.config.enableAnalytics) return;
    
    console.log(`AI Assistant: ${type} (${duration}ms) - ${success ? 'Success' : 'Failed'} with ${model || 'unknown'}`);
    
    this.metrics[`assistant_${type}`] = (this.metrics[`assistant_${type}`] || 0) + 1;
  }
  
  /**
   * Record custom metrics
   */
  recordMetric(name: string, data: Record<string, any>, value?: number) {
    if (!this.isInitialized) return;
    
    console.log(`Metric: ${name}`, data);
    
    this.metrics[name] = value !== undefined ? value : data;
  }
  
  /**
   * Record errors
   */
  recordError(
    error: Error,
    type: 'javascript' | 'promise' | 'network' | 'user' | string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    metadata: Record<string, any> = {}
  ) {
    if (!this.isInitialized || !this.config.enableErrorTracking) return;
    
    console.error(`PWA Error [${type}/${severity}]:`, error.message, metadata);
    
    const errorKey = `error_${type}_${severity}`;
    this.metrics[errorKey] = (this.metrics[errorKey] || 0) + 1;
  }
  
  /**
   * Start a span for tracking operations
   */
  startSpan(operationName: string, attributes: Record<string, any> = {}) {
    if (!this.isInitialized) return null;
    
    const spanId = `${operationName}_${Date.now()}`;
    console.log(`Span started: ${spanId}`, attributes);
    
    return {
      end: () => {
        console.log(`Span ended: ${spanId}`);
      },
      setAttributes: (attrs: Record<string, any>) => {
        console.log(`Span attributes: ${spanId}`, attrs);
      },
      recordException: (error: Error) => {
        console.error(`Span exception: ${spanId}`, error);
      },
      setStatus: (status: any) => {
        console.log(`Span status: ${spanId}`, status);
      },
    };
  }
  
  /**
   * Set user context for tracking
   */
  setUserContext(userId: string, attributes: Record<string, any> = {}) {
    if (!this.isInitialized) return;
    
    console.log(`User context set: ${userId}`, attributes);
    
    this.metrics['user_context'] = { userId, ...attributes };
  }
  
  /**
   * Track user interactions
   */
  trackInteraction(element: string, action: string, metadata: Record<string, any> = {}) {
    if (!this.isInitialized || !this.config.enableAnalytics) return;
    
    console.log(`User Interaction: ${action} on ${element}`, metadata);
    
    this.metrics[`interaction_${action}`] = (this.metrics[`interaction_${action}`] || 0) + 1;
  }
  
  /**
   * Track custom events
   */
  trackEvent(category: string, action: string, label?: string, value?: number) {
    if (!this.isInitialized || !this.config.enableAnalytics) return;
    
    console.log(`Event: ${category}/${action}`, { label, value });
    
    const eventKey = `event_${category}_${action}`;
    this.metrics[eventKey] = (this.metrics[eventKey] || 0) + 1;
  }
  
  /**
   * Track API calls
   */
  trackAPICall(endpoint: string, method: string, duration: number, success: boolean) {
    if (!this.isInitialized) return;
    
    console.log(`API Call: ${method} ${endpoint} (${duration}ms) - ${success ? 'Success' : 'Failed'}`);
    
    const apiKey = `api_${method.toLowerCase()}_${success ? 'success' : 'error'}`;
    this.metrics[apiKey] = (this.metrics[apiKey] || 0) + 1;
  }
  
  /**
   * Record performance metrics
   */
  recordPerformance(metric: string, data: Record<string, number>) {
    if (!this.isInitialized || !this.config.enablePerformanceTracking) return;
    
    console.log(`Performance: ${metric}`, data);
    
    this.metrics[`perf_${metric}`] = data;
  }
  
  /**
   * Get current metrics for debugging
   */
  getMetrics() {
    return {
      telemetry_initialized: this.isInitialized,
      environment: ENVIRONMENT,
      version: APP_VERSION,
      metrics: this.metrics,
    };
  }
  
  /**
   * Flush any pending data (no-op in simplified version)
   */
  async flush(): Promise<void> {
    console.log('Flushing PWA telemetry data...');
  }
}

// Create singleton instance
const pwaTelemetry = new PWATelemetry();

// Export singleton and class
export { pwaTelemetry as default, PWATelemetry };
export type { TelemetryConfig };

// Graceful cleanup
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    pwaTelemetry.flush();
  });
}