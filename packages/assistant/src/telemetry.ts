/**
 * Simplified Telemetry for Grahmos Assistant Package
 * Basic metrics and logging without complex OpenTelemetry setup
 */

// Application configuration
const APP_NAME = 'grahmos-assistant';
const APP_VERSION = process.env.GRAHMOS_ASSISTANT_VERSION || '2.0.0';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

// Telemetry configuration
interface AssistantTelemetryConfig {
  enabled: boolean;
  prometheusPort: number;
  enableTracing: boolean;
  enableMetrics: boolean;
}

const defaultConfig: AssistantTelemetryConfig = {
  enabled: process.env.ASSISTANT_TELEMETRY_ENABLED !== 'false',
  prometheusPort: parseInt(process.env.PROMETHEUS_METRICS_PORT || '9464'),
  enableTracing: true,
  enableMetrics: true,
};

class AssistantTelemetry {
  private isInitialized = false;
  private config: AssistantTelemetryConfig;
  
  // Simple metrics storage
  private metrics: Record<string, number> = {};
  
  constructor(config: Partial<AssistantTelemetryConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    
    if (this.config.enabled) {
      this.initialize();
    }
  }
  
  private initialize() {
    try {
      this.isInitialized = true;
      console.log(`${APP_NAME} telemetry initialized successfully`);
    } catch (error) {
      console.error(`Failed to initialize ${APP_NAME} telemetry:`, error);
    }
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
    
    const metricKey = `llm_requests_${success ? 'success' : 'error'}`;
    this.metrics[metricKey] = (this.metrics[metricKey] || 0) + 1;
    
    if (this.config.enableTracing) {
      console.log(`LLM Request: ${model}, Duration: ${duration}ms, Success: ${success}`);
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
    
    const metricKey = `tts_requests_${success ? 'success' : 'error'}`;
    this.metrics[metricKey] = (this.metrics[metricKey] || 0) + 1;
    
    if (this.config.enableTracing) {
      console.log(`TTS Request: ${engine}, Duration: ${duration}ms, Success: ${success}`);
    }
  }
  
  /**
   * Track session lifecycle
   */
  trackSessionStart(sessionId: string, attributes: Record<string, any> = {}) {
    if (!this.isInitialized) return;
    
    this.metrics['active_sessions'] = (this.metrics['active_sessions'] || 0) + 1;
    
    if (this.config.enableTracing) {
      console.log(`Session started: ${this.hashSessionId(sessionId)}`);
    }
  }
  
  trackSessionEnd(sessionId: string, duration: number, messageCount: number) {
    if (!this.isInitialized) return;
    
    this.metrics['active_sessions'] = Math.max(0, (this.metrics['active_sessions'] || 0) - 1);
    
    if (this.config.enableTracing) {
      console.log(`Session ended: ${this.hashSessionId(sessionId)}, Duration: ${duration}ms, Messages: ${messageCount}`);
    }
  }
  
  /**
   * Create a simple span for assistant operations
   */
  startSpan(
    name: string,
    attributes: Record<string, any> = {},
    parentSpan?: any
  ) {
    if (!this.isInitialized) return null;
    
    const spanId = `${name}_${Date.now()}`;
    
    if (this.config.enableTracing) {
      console.log(`Span started: ${spanId}`, attributes);
    }
    
    return {
      end: () => {
        if (this.config.enableTracing) {
          console.log(`Span ended: ${spanId}`);
        }
      },
      setAttributes: (attrs: Record<string, any>) => {
        if (this.config.enableTracing) {
          console.log(`Span attributes: ${spanId}`, attrs);
        }
      },
      recordException: (error: Error) => {
        console.error(`Span exception: ${spanId}`, error);
      },
      setStatus: (status: any) => {
        if (this.config.enableTracing) {
          console.log(`Span status: ${spanId}`, status);
        }
      }
    };
  }
  
  /**
   * Record a custom metric
   */
  recordCustomMetric(name: string, value: number, attributes: Record<string, any> = {}) {
    if (!this.isInitialized) return;
    
    this.metrics[name] = value;
    
    if (this.config.enableTracing) {
      console.log(`Custom metric: ${name} = ${value}`, attributes);
    }
  }
  
  /**
   * Record an error
   */
  recordError(
    error: Error,
    component: 'llm' | 'tts' | 'session' | 'general',
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    attributes: Record<string, any> = {}
  ) {
    if (!this.isInitialized) return;
    
    const errorKey = `errors_${component}_${severity}`;
    this.metrics[errorKey] = (this.metrics[errorKey] || 0) + 1;
    
    console.error(`Assistant Error [${component}/${severity}]:`, error.message, attributes);
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
    console.log('Flushing telemetry data...');
  }
  
  /**
   * Get current metrics for health checks
   */
  getHealthMetrics() {
    return {
      telemetry_initialized: this.isInitialized,
      prometheus_port: this.config.prometheusPort,
      metrics_enabled: this.config.enableMetrics,
      tracing_enabled: this.config.enableTracing,
      current_metrics: this.metrics,
    };
  }
}

// Create singleton instance
const assistantTelemetry = new AssistantTelemetry();

// Export singleton and class for custom configurations
export { assistantTelemetry as default, AssistantTelemetry };
export type { AssistantTelemetryConfig };

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('Shutting down assistant telemetry...');
  await assistantTelemetry.flush();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down assistant telemetry...');
  await assistantTelemetry.flush();
  process.exit(0);
});