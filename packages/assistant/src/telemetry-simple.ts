/**
 * Simplified OpenTelemetry instrumentation for Grahmos Assistant Package
 * Provides basic telemetry for AI assistant operations without complex setup
 */

import { 
  metrics,
  trace,
  SpanKind,
  SpanStatusCode 
} from '@opentelemetry/api';

// Application configuration
const APP_NAME = 'grahmos-assistant';
const APP_VERSION = process.env.GRAHMOS_ASSISTANT_VERSION || '2.0.0';

// Telemetry configuration
interface AssistantTelemetryConfig {
  enabled: boolean;
  enableMetrics: boolean;
}

const defaultConfig: AssistantTelemetryConfig = {
  enabled: process.env.ASSISTANT_TELEMETRY_ENABLED !== 'false',
  enableMetrics: true,
};

class AssistantTelemetry {
  private isInitialized = false;
  private config: AssistantTelemetryConfig;
  
  // Metrics
  private llmRequestCounter: any;
  private llmResponseTimeHistogram: any;
  private ttsRequestCounter: any;
  private ttsResponseTimeHistogram: any;
  private errorCounter: any;
  private activeSessionsGauge: any;
  
  constructor(config: Partial<AssistantTelemetryConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    
    if (this.config.enabled) {
      this.initialize();
    }
  }
  
  private initialize() {
    try {
      // Initialize custom metrics
      this.initializeMetrics();
      
      this.isInitialized = true;
      console.log(`${APP_NAME} telemetry initialized successfully`);
      
    } catch (error) {
      console.error(`Failed to initialize ${APP_NAME} telemetry:`, error);
    }
  }
  
  private initializeMetrics() {
    const meter = metrics.getMeter(APP_NAME, APP_VERSION);
    
    // LLM request metrics
    this.llmRequestCounter = meter.createCounter('assistant_llm_requests_total', {
      description: 'Total number of LLM requests',
      unit: '1',
    });
    
    this.llmResponseTimeHistogram = meter.createHistogram('assistant_llm_response_duration', {
      description: 'LLM response time distribution',
      unit: 'ms',
    });
    
    // TTS request metrics
    this.ttsRequestCounter = meter.createCounter('assistant_tts_requests_total', {
      description: 'Total number of TTS requests',
      unit: '1',
    });
    
    this.ttsResponseTimeHistogram = meter.createHistogram('assistant_tts_response_duration', {
      description: 'TTS response time distribution',
      unit: 'ms',
    });
    
    // Error metrics
    this.errorCounter = meter.createCounter('assistant_errors_total', {
      description: 'Total number of assistant errors',
      unit: '1',
    });
    
    // Active sessions gauge
    this.activeSessionsGauge = meter.createUpDownCounter('assistant_active_sessions', {
      description: 'Number of active assistant sessions',
      unit: '1',
    });
  }
  
  // Public API methods
  
  /**
   * Record an LLM request
   */
  recordLLMRequest(
    model: string,
    duration: number,
    success: boolean,
    tokenCount?: { input: number; output: number },
    errorType?: string
  ) {
    if (!this.isInitialized) return;
    
    const attributes = {
      'llm.model': model,
      'llm.success': success,
      'llm.provider': this.extractProvider(model),
      ...(tokenCount && {
        'llm.tokens.input': tokenCount.input,
        'llm.tokens.output': tokenCount.output,
        'llm.tokens.total': tokenCount.input + tokenCount.output,
      }),
      ...(errorType && { 'llm.error.type': errorType }),
    };
    
    this.llmRequestCounter?.add(1, attributes);
    this.llmResponseTimeHistogram?.record(duration, attributes);
    
    if (!success && errorType) {
      this.errorCounter?.add(1, {
        'error.component': 'llm',
        'error.type': errorType,
        'llm.model': model,
      });
    }
  }
  
  /**
   * Record a TTS request
   */
  recordTTSRequest(
    engine: string,
    duration: number,
    success: boolean,
    audioLength?: number,
    errorType?: string
  ) {
    if (!this.isInitialized) return;
    
    const attributes = {
      'tts.engine': engine,
      'tts.success': success,
      ...(audioLength && { 'tts.audio.duration': audioLength }),
      ...(errorType && { 'tts.error.type': errorType }),
    };
    
    this.ttsRequestCounter?.add(1, attributes);
    this.ttsResponseTimeHistogram?.record(duration, attributes);
    
    if (!success && errorType) {
      this.errorCounter?.add(1, {
        'error.component': 'tts',
        'error.type': errorType,
        'tts.engine': engine,
      });
    }
  }
  
  /**
   * Track session lifecycle
   */
  trackSessionStart(sessionId: string, attributes: Record<string, any> = {}) {
    if (!this.isInitialized) return;
    
    this.activeSessionsGauge?.add(1, {
      'session.id': this.hashSessionId(sessionId),
      'session.action': 'start',
      ...attributes,
    });
  }
  
  trackSessionEnd(sessionId: string, duration: number, messageCount: number) {
    if (!this.isInitialized) return;
    
    this.activeSessionsGauge?.add(-1, {
      'session.id': this.hashSessionId(sessionId),
      'session.action': 'end',
      'session.duration': duration,
      'session.message_count': messageCount,
    });
  }
  
  /**
   * Create a span for assistant operations
   */
  startSpan(
    name: string,
    attributes: Record<string, any> = {}
  ) {
    if (!this.isInitialized) return null;
    
    const tracer = trace.getTracer(APP_NAME, APP_VERSION);
    const span = tracer.startSpan(`assistant_${name}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'assistant.operation': name,
        ...attributes,
      },
    });
    return span;
  }
  
  /**
   * Record a custom metric
   */
  recordCustomMetric(name: string, value: number, attributes: Record<string, any> = {}) {
    if (!this.isInitialized) return;
    
    const meter = metrics.getMeter(APP_NAME, APP_VERSION);
    const counter = meter.createCounter(`assistant_${name}_total`);
    counter.add(value, attributes);
  }
  
  /**
   * Record an error
   */
  recordError(
    error: Error,
    component: 'llm' | 'tts' | 'session' | 'general',
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) {
    if (!this.isInitialized) return;
    
    this.errorCounter?.add(1, {
      'error.component': component,
      'error.type': error.name,
      'error.severity': severity,
    });
    
    // Create error span
    const span = this.startSpan('error', {
      'error.component': component,
      'error.severity': severity,
      'error.message': error.message,
    });
    
    if (span) {
      span.recordException(error);
      span.setStatus({ 
        code: SpanStatusCode.ERROR, 
        message: error.message 
      });
      span.end();
    }
  }
  
  // Utility methods
  
  private extractProvider(model: string): string {
    // Extract provider from model name
    if (model.includes('gemma')) return 'google';
    if (model.includes('gpt') || model.includes('openai')) return 'openai';
    if (model.includes('claude')) return 'anthropic';
    if (model.includes('llama')) return 'meta';
    return 'unknown';
  }
  
  private hashSessionId(sessionId: string): string {
    // Simple hash for privacy-safe session tracking
    let hash = 0;
    for (let i = 0; i < sessionId.length; i++) {
      const char = sessionId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
  
  /**
   * Flush all pending telemetry data
   */
  async flush(): Promise<void> {
    // Simple no-op flush for this simplified version
    console.log('Telemetry flush completed');
  }
  
  /**
   * Get current metrics for health checks
   */
  getHealthMetrics() {
    return {
      telemetry_initialized: this.isInitialized,
      metrics_enabled: this.config.enableMetrics,
    };
  }
}

// Create singleton instance
const assistantTelemetry = new AssistantTelemetry();

// Export singleton and class for custom configurations
export { assistantTelemetry as default, AssistantTelemetry };
export type { AssistantTelemetryConfig };
