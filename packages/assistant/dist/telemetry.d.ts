/**
 * OpenTelemetry Node.js Instrumentation for Grahmos Assistant Package
 * Provides server-side telemetry for AI assistant operations
 */
interface AssistantTelemetryConfig {
    enabled: boolean;
    collectorUrl: string;
    prometheusPort: number;
    sampleRate: number;
    enableTracing: boolean;
    enableMetrics: boolean;
}
declare class AssistantTelemetry {
    private isInitialized;
    private config;
    private llmRequestCounter;
    private llmResponseTimeHistogram;
    private ttsRequestCounter;
    private ttsResponseTimeHistogram;
    private errorCounter;
    private activeSessionsGauge;
    constructor(config?: Partial<AssistantTelemetryConfig>);
    private initialize;
    private initializeMetrics;
    /**
     * Record an LLM request
     */
    recordLLMRequest(model: string, duration: number, success: boolean, tokenCount?: {
        input: number;
        output: number;
    }, errorType?: string): void;
    /**
     * Record a TTS request
     */
    recordTTSRequest(engine: string, duration: number, success: boolean, audioLength?: number, errorType?: string): void;
    /**
     * Track session lifecycle
     */
    trackSessionStart(sessionId: string, attributes?: Record<string, any>): void;
    trackSessionEnd(sessionId: string, duration: number, messageCount: number): void;
    /**
     * Create a span for assistant operations
     */
    startSpan(name: string, attributes?: Record<string, any>, parentSpan?: any): import("@opentelemetry/api").Span | null;
    /**
     * Record a custom metric
     */
    recordCustomMetric(name: string, value: number, attributes?: Record<string, any>): void;
    /**
     * Record an error
     */
    recordError(error: Error, component: 'llm' | 'tts' | 'session' | 'general', severity?: 'low' | 'medium' | 'high' | 'critical', attributes?: Record<string, any>): void;
    private extractProvider;
    private hashSessionId;
    /**
     * Flush all pending telemetry data
     */
    flush(): Promise<void>;
    /**
     * Get current metrics for health checks
     */
    getHealthMetrics(): {
        telemetry_initialized: boolean;
        prometheus_port: number;
        metrics_enabled: boolean;
        tracing_enabled: boolean;
    };
}
declare const assistantTelemetry: AssistantTelemetry;
export { assistantTelemetry as default, AssistantTelemetry };
export type { AssistantTelemetryConfig };
//# sourceMappingURL=telemetry.d.ts.map