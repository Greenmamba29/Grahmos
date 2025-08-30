/**
 * OpenTelemetry Web Instrumentation for Grahmos PWA Shell
 * Simplified version with correct Web SDK integration
 */

import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
// import { Resource } from '@opentelemetry/resources';
// import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { 
  metrics,
  trace,
  SpanKind,
  SpanStatusCode 
} from '@opentelemetry/api';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';

// Application configuration
const APP_NAME = 'grahmos-pwa';
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '2.0.0';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

// Telemetry configuration
interface TelemetryConfig {
  enabled: boolean;
  enableUserInteraction: boolean;
  enablePerformance: boolean;
  enableErrors: boolean;
}

const defaultConfig: TelemetryConfig = {
  enabled: process.env.NEXT_PUBLIC_TELEMETRY_ENABLED !== 'false',
  enableUserInteraction: true,
  enablePerformance: true,
  enableErrors: true,
};

class GrahmosTelemetry {
  private tracerProvider: WebTracerProvider | null = null;
  private isInitialized = false;
  private config: TelemetryConfig;
  
  // Metrics
  private pageViewCounter: any;
  private searchCounter: any;
  private assistantInteractionCounter: any;
  private errorCounter: any;
  private performanceHistogram: any;
  
  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    
    if (this.config.enabled && typeof window !== 'undefined') {
      this.initialize();
    }
  }
  
  private initialize() {
    try {
      // Create tracer provider without resource for simplicity
      this.tracerProvider = new WebTracerProvider();
      
      // Register the provider
      trace.setGlobalTracerProvider(this.tracerProvider);
      
      // Initialize custom instrumentations
      this.initializeCustomInstrumentations();
      
      // Initialize custom metrics
      this.initializeMetrics();
      
      this.isInitialized = true;
      console.log('Grahmos Telemetry initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize Grahmos Telemetry:', error);
    }
  }
  
  private initializeCustomInstrumentations() {
    // Register basic instrumentations
    registerInstrumentations({
      instrumentations: [
        new FetchInstrumentation({
          ignoreUrls: [
            // Ignore telemetry endpoints to prevent loops
            /.*\/v1\/(traces|metrics|logs).*/,
          ],
          applyCustomAttributesOnSpan: (span: any, request: any) => {
            // Add custom attributes for Grahmos API calls
            if (request.url?.includes('/api/')) {
              span.setAttributes({
                'grahmos.api.endpoint': new URL(request.url).pathname,
                'grahmos.api.version': request.url.includes('/v1/') ? 'v1' : 
                                       request.url.includes('/v2/') ? 'v2' : 'unknown',
              });
            }
          },
        }),
        
        new UserInteractionInstrumentation({
          eventNames: ['click', 'submit', 'change', 'keydown'],
          shouldPreventSpanCreation: (eventType: any, element: any) => {
            // Ignore tracking pixels and analytics elements
            return element?.classList?.contains('no-telemetry') || false;
          },
        }),
      ],
    });
  }
  
  private initializeMetrics() {
    const meter = metrics.getMeter(APP_NAME, APP_VERSION);
    
    // Page view counter
    this.pageViewCounter = meter.createCounter('grahmos_page_views_total', {
      description: 'Total number of page views',
      unit: '1',
    });
    
    // Search metrics
    this.searchCounter = meter.createCounter('grahmos_searches_total', {
      description: 'Total number of searches performed',
      unit: '1',
    });
    
    // Assistant interaction metrics  
    this.assistantInteractionCounter = meter.createCounter('grahmos_assistant_interactions_total', {
      description: 'Total number of AI assistant interactions',
      unit: '1',
    });
    
    // Error counter
    this.errorCounter = meter.createCounter('grahmos_errors_total', {
      description: 'Total number of application errors',
      unit: '1',
    });
    
    // Performance metrics
    this.performanceHistogram = meter.createHistogram('grahmos_operation_duration', {
      description: 'Duration of various operations',
      unit: 'ms',
    });
  }
  
  // Public API methods
  
  /**
   * Record a page view
   */
  recordPageView(pathname: string, additionalAttributes: Record<string, any> = {}) {
    if (!this.isInitialized) return;
    
    const attributes = {
      'page.path': pathname,
      'page.referrer': typeof document !== 'undefined' ? document.referrer : '',
      'user_agent': typeof navigator !== 'undefined' ? navigator.userAgent : '',
      ...additionalAttributes,
    };
    
    this.pageViewCounter?.add(1, attributes);
    
    // Create a span for the page view
    const tracer = trace.getTracer(APP_NAME);
    const span = tracer.startSpan('page_view', {
      kind: SpanKind.CLIENT,
      attributes,
    });
    
    span.end();
  }
  
  /**
   * Record a search operation
   */
  recordSearch(query: string, results: number, duration: number, source: 'local' | 'remote' = 'local') {
    if (!this.isInitialized) return;
    
    const attributes = {
      'search.query_length': query.length,
      'search.results_count': results,
      'search.source': source,
      'search.has_results': results > 0,
    };
    
    this.searchCounter?.add(1, attributes);
    this.performanceHistogram?.record(duration, {
      ...attributes,
      'operation': 'search',
    });
    
    // Create search span
    const tracer = trace.getTracer(APP_NAME);
    const span = tracer.startSpan('search_operation', {
      kind: SpanKind.CLIENT,
      attributes: {
        ...attributes,
        'search.query_hash': this.hashQuery(query), // Privacy-safe query tracking
      },
    });
    
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  }
  
  /**
   * Record AI assistant interaction
   */
  recordAssistantInteraction(
    type: 'question' | 'command' | 'feedback',
    duration: number,
    success: boolean,
    model?: string
  ) {
    if (!this.isInitialized) return;
    
    const attributes = {
      'assistant.interaction_type': type,
      'assistant.success': success,
      'assistant.model': model || 'unknown',
    };
    
    this.assistantInteractionCounter?.add(1, attributes);
    this.performanceHistogram?.record(duration, {
      ...attributes,
      'operation': 'assistant_interaction',
    });
  }
  
  /**
   * Record an error
   */
  recordError(error: Error, context: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') {
    if (!this.isInitialized) return;
    
    const attributes = {
      'error.type': error.name,
      'error.message': error.message,
      'error.context': context,
      'error.severity': severity,
      'page.path': typeof window !== 'undefined' ? window.location.pathname : '',
    };
    
    this.errorCounter?.add(1, attributes);
    
    // Create error span
    const tracer = trace.getTracer(APP_NAME);
    const span = tracer.startSpan('error_occurred', {
      kind: SpanKind.CLIENT,
      attributes,
    });
    
    span.recordException(error);
    span.setStatus({ 
      code: SpanStatusCode.ERROR, 
      message: error.message 
    });
    span.end();
  }
  
  /**
   * Record custom metric
   */
  recordMetric(name: string, attributes: Record<string, any>, value: number = 1) {
    if (!this.isInitialized) return;
    
    const meter = metrics.getMeter(APP_NAME, APP_VERSION);
    const counter = meter.createCounter(`grahmos_${name}_total`);
    counter.add(value, attributes);
  }
  
  /**
   * Start a custom operation span
   */
  startSpan(name: string, attributes: Record<string, any> = {}) {
    if (!this.isInitialized) return null;
    
    const tracer = trace.getTracer(APP_NAME);
    return tracer.startSpan(`grahmos_${name}`, {
      kind: SpanKind.CLIENT,
      attributes,
    });
  }
  
  /**
   * Set user context (privacy-conscious)
   */
  setUserContext(userId: string, attributes: Record<string, any> = {}) {
    if (!this.isInitialized) return;
    
    // Hash user ID for privacy
    const hashedUserId = this.hashUserId(userId);
    
    const userAttributes = {
      'user.id': hashedUserId,
      'user.session_id': this.getSessionId(),
      ...attributes,
    };
    
    // Set user context in active span
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.setAttributes(userAttributes);
    }
  }
  
  // Utility methods
  
  private hashQuery(query: string): string {
    // Simple hash for privacy-safe query tracking
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
  
  private hashUserId(userId: string): string {
    // Hash user ID for privacy
    return this.hashQuery(userId + 'grahmos_salt');
  }
  
  private getSessionId(): string {
    // Get or create session ID
    if (typeof window === 'undefined') return 'unknown';
    
    let sessionId = sessionStorage.getItem('grahmos_session_id');
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2, 15) + 
                  Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('grahmos_session_id', sessionId);
    }
    
    return sessionId;
  }
  
  /**
   * Flush all pending telemetry data
   */
  async flush(): Promise<void> {
    if (this.tracerProvider) {
      await this.tracerProvider.shutdown();
    }
  }
}

// Create singleton instance
const telemetry = new GrahmosTelemetry();

// Export singleton and class for custom configurations
export { telemetry as default, GrahmosTelemetry };
export type { TelemetryConfig };
