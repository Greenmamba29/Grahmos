/**
 * OpenTelemetry Node.js Instrumentation for Grahmos Assistant Package
 * Provides server-side telemetry for AI assistant operations
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { 
  metrics,
  trace,
  SpanKind,
  SpanStatusCode 
} from '@opentelemetry/api';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

// Application configuration
const APP_NAME = 'grahmos-assistant';
const APP_VERSION = process.env.GRAHMOS_ASSISTANT_VERSION || '2.0.0';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

// Telemetry configuration
interface AssistantTelemetryConfig {
  enabled: boolean;
  collectorUrl: string;
  prometheusPort: number;
  sampleRate: number;
  enableTracing: boolean;
  enableMetrics: boolean;
}

const defaultConfig: AssistantTelemetryConfig = {
  enabled: process.env.ASSISTANT_TELEMETRY_ENABLED !== 'false',
  collectorUrl: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
  prometheusPort: parseInt(process.env.PROMETHEUS_METRICS_PORT || '9464'),
  sampleRate: parseFloat(process.env.TELEMETRY_SAMPLE_RATE || '0.1'),
  enableTracing: true,
  enableMetrics: true,
};

class AssistantTelemetry {
  private sdk: NodeSDK | null = null;
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
      // Create resource with service metadata
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: APP_NAME,
        [SemanticResourceAttributes.SERVICE_VERSION]: APP_VERSION,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: ENVIRONMENT,
        [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'grahmos',
        'service.component': 'assistant',
        'service.instance.id': process.env.HOSTNAME || 'localhost',
      });
      
      // Configure Prometheus exporter
      const prometheusExporter = new PrometheusExporter({
        port: this.config.prometheusPort,
        endpoint: '/metrics',
      });
      
      // Configure SDK
      this.sdk = new NodeSDK({
        resource,
        instrumentations: getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {\n            enabled: false, // Too noisy for assistant operations\n          },\n          '@opentelemetry/instrumentation-http': {\n            enabled: this.config.enableTracing,\n            requestHook: (span, request) => {\n              // Add assistant-specific attributes\n              span.setAttributes({\n                'assistant.request.method': request.method,\n                'assistant.request.url': request.url,\n              });\n            },\n          },\n        }),\n        metricReader: new PeriodicExportingMetricReader({\n          exporter: prometheusExporter,\n          exportIntervalMillis: 5000,\n        }),\n      });\n      \n      // Initialize SDK\n      this.sdk.start();\n      \n      // Initialize custom metrics\n      this.initializeMetrics();\n      \n      this.isInitialized = true;\n      console.log(`${APP_NAME} telemetry initialized successfully`);\n      \n    } catch (error) {\n      console.error(`Failed to initialize ${APP_NAME} telemetry:`, error);\n    }\n  }\n  \n  private initializeMetrics() {\n    const meter = metrics.getMeter(APP_NAME, APP_VERSION);\n    \n    // LLM request metrics\n    this.llmRequestCounter = meter.createCounter('assistant_llm_requests_total', {\n      description: 'Total number of LLM requests',\n      unit: '1',\n    });\n    \n    this.llmResponseTimeHistogram = meter.createHistogram('assistant_llm_response_duration', {\n      description: 'LLM response time distribution',\n      unit: 'ms',\n      boundaries: [10, 50, 100, 500, 1000, 5000, 10000, 30000],\n    });\n    \n    // TTS request metrics\n    this.ttsRequestCounter = meter.createCounter('assistant_tts_requests_total', {\n      description: 'Total number of TTS requests',\n      unit: '1',\n    });\n    \n    this.ttsResponseTimeHistogram = meter.createHistogram('assistant_tts_response_duration', {\n      description: 'TTS response time distribution',\n      unit: 'ms',\n      boundaries: [10, 50, 100, 500, 1000, 2000, 5000],\n    });\n    \n    // Error metrics\n    this.errorCounter = meter.createCounter('assistant_errors_total', {\n      description: 'Total number of assistant errors',\n      unit: '1',\n    });\n    \n    // Active sessions gauge\n    this.activeSessionsGauge = meter.createUpDownCounter('assistant_active_sessions', {\n      description: 'Number of active assistant sessions',\n      unit: '1',\n    });\n  }\n  \n  // Public API methods\n  \n  /**\n   * Record an LLM request\n   */\n  recordLLMRequest(\n    model: string,\n    duration: number,\n    success: boolean,\n    tokenCount?: { input: number; output: number },\n    errorType?: string\n  ) {\n    if (!this.isInitialized) return;\n    \n    const attributes = {\n      'llm.model': model,\n      'llm.success': success,\n      'llm.provider': this.extractProvider(model),\n      ...(tokenCount && {\n        'llm.tokens.input': tokenCount.input,\n        'llm.tokens.output': tokenCount.output,\n        'llm.tokens.total': tokenCount.input + tokenCount.output,\n      }),\n      ...(errorType && { 'llm.error.type': errorType }),\n    };\n    \n    this.llmRequestCounter?.add(1, attributes);\n    this.llmResponseTimeHistogram?.record(duration, attributes);\n    \n    if (!success && errorType) {\n      this.errorCounter?.add(1, {\n        'error.component': 'llm',\n        'error.type': errorType,\n        'llm.model': model,\n      });\n    }\n  }\n  \n  /**\n   * Record a TTS request\n   */\n  recordTTSRequest(\n    engine: string,\n    duration: number,\n    success: boolean,\n    audioLength?: number,\n    errorType?: string\n  ) {\n    if (!this.isInitialized) return;\n    \n    const attributes = {\n      'tts.engine': engine,\n      'tts.success': success,\n      ...(audioLength && { 'tts.audio.duration': audioLength }),\n      ...(errorType && { 'tts.error.type': errorType }),\n    };\n    \n    this.ttsRequestCounter?.add(1, attributes);\n    this.ttsResponseTimeHistogram?.record(duration, attributes);\n    \n    if (!success && errorType) {\n      this.errorCounter?.add(1, {\n        'error.component': 'tts',\n        'error.type': errorType,\n        'tts.engine': engine,\n      });\n    }\n  }\n  \n  /**\n   * Track session lifecycle\n   */\n  trackSessionStart(sessionId: string, attributes: Record<string, any> = {}) {\n    if (!this.isInitialized) return;\n    \n    this.activeSessionsGauge?.add(1, {\n      'session.id': this.hashSessionId(sessionId),\n      'session.action': 'start',\n      ...attributes,\n    });\n  }\n  \n  trackSessionEnd(sessionId: string, duration: number, messageCount: number) {\n    if (!this.isInitialized) return;\n    \n    this.activeSessionsGauge?.add(-1, {\n      'session.id': this.hashSessionId(sessionId),\n      'session.action': 'end',\n      'session.duration': duration,\n      'session.message_count': messageCount,\n    });\n  }\n  \n  /**\n   * Create a span for assistant operations\n   */\n  startSpan(\n    name: string,\n    attributes: Record<string, any> = {},\n    parentSpan?: any\n  ) {\n    if (!this.isInitialized) return null;\n    \n    const tracer = trace.getTracer(APP_NAME, APP_VERSION);\n    return tracer.startSpan(`assistant_${name}`, {\n      kind: SpanKind.SERVER,\n      parent: parentSpan,\n      attributes: {\n        'assistant.operation': name,\n        ...attributes,\n      },\n    });\n  }\n  \n  /**\n   * Record a custom metric\n   */\n  recordCustomMetric(name: string, value: number, attributes: Record<string, any> = {}) {\n    if (!this.isInitialized) return;\n    \n    const meter = metrics.getMeter(APP_NAME, APP_VERSION);\n    const counter = meter.createCounter(`assistant_${name}_total`);\n    counter.add(value, attributes);\n  }\n  \n  /**\n   * Record an error\n   */\n  recordError(\n    error: Error,\n    component: 'llm' | 'tts' | 'session' | 'general',\n    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',\n    attributes: Record<string, any> = {}\n  ) {\n    if (!this.isInitialized) return;\n    \n    this.errorCounter?.add(1, {\n      'error.component': component,\n      'error.type': error.name,\n      'error.severity': severity,\n      ...attributes,\n    });\n    \n    // Create error span\n    const span = this.startSpan('error', {\n      'error.component': component,\n      'error.severity': severity,\n      'error.message': error.message,\n      ...attributes,\n    });\n    \n    if (span) {\n      span.recordException(error);\n      span.setStatus({ \n        code: SpanStatusCode.ERROR, \n        message: error.message \n      });\n      span.end();\n    }\n  }\n  \n  // Utility methods\n  \n  private extractProvider(model: string): string {\n    // Extract provider from model name\n    if (model.includes('gemma')) return 'google';\n    if (model.includes('gpt') || model.includes('openai')) return 'openai';\n    if (model.includes('claude')) return 'anthropic';\n    if (model.includes('llama')) return 'meta';\n    return 'unknown';\n  }\n  \n  private hashSessionId(sessionId: string): string {\n    // Simple hash for privacy-safe session tracking\n    let hash = 0;\n    for (let i = 0; i < sessionId.length; i++) {\n      const char = sessionId.charCodeAt(i);\n      hash = ((hash << 5) - hash) + char;\n      hash = hash & hash; // Convert to 32-bit integer\n    }\n    return Math.abs(hash).toString(16);\n  }\n  \n  /**\n   * Flush all pending telemetry data\n   */\n  async flush(): Promise<void> {\n    if (this.sdk) {\n      await this.sdk.shutdown();\n    }\n  }\n  \n  /**\n   * Get current metrics for health checks\n   */\n  getHealthMetrics() {\n    return {\n      telemetry_initialized: this.isInitialized,\n      prometheus_port: this.config.prometheusPort,\n      metrics_enabled: this.config.enableMetrics,\n      tracing_enabled: this.config.enableTracing,\n    };\n  }\n}\n\n// Create singleton instance\nconst assistantTelemetry = new AssistantTelemetry();\n\n// Export singleton and class for custom configurations\nexport { assistantTelemetry as default, AssistantTelemetry };\nexport type { AssistantTelemetryConfig };\n\n// Graceful shutdown handler\nprocess.on('SIGTERM', async () => {\n  console.log('Shutting down assistant telemetry...');\n  await assistantTelemetry.flush();\n  process.exit(0);\n});\n\nprocess.on('SIGINT', async () => {\n  console.log('Shutting down assistant telemetry...');\n  await assistantTelemetry.flush();\n  process.exit(0);\n});"}}]}
</function_results>

<function_calls>
<invoke name="mark_todo_as_done">
<parameter name="todo_ids">["2e20a340-5e01-4484-a84c-9ab3ac4c346f", "b20d646f-ca52-44c9-8443-aea444dececb"]
