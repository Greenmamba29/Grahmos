/**
 * AI-Enhanced Security Threat Detection System
 *
 * This module provides comprehensive ML-powered security threat detection including:
 * - Anomaly detection using isolation forests and autoencoders
 * - Behavioral analysis and user profiling
 * - Network traffic analysis
 * - Real-time threat scoring and classification
 * - Integration with incident response system
 */
import { z } from 'zod';
export interface SecurityEvent {
    id: string;
    timestamp: number;
    userId?: string;
    sessionId?: string;
    ip: string;
    userAgent: string;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
    dataSize: number;
    headers: Record<string, string>;
    payload?: any;
    geoLocation?: {
        country: string;
        city: string;
        lat: number;
        lon: number;
    };
}
export interface ThreatDetectionResult {
    eventId: string;
    threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    score: number;
    threats: ThreatType[];
    anomalies: AnomalyResult[];
    behaviorAnalysis: BehaviorAnalysis;
    recommendations: string[];
    autoActions?: string[];
}
export interface ThreatType {
    type: string;
    confidence: number;
    description: string;
    indicators: string[];
}
export interface AnomalyResult {
    type: 'statistical' | 'ml' | 'behavioral';
    score: number;
    threshold: number;
    description: string;
    features: Record<string, number>;
}
export interface BehaviorAnalysis {
    userProfile: UserBehaviorProfile;
    sessionAnalysis: SessionAnalysis;
    riskFactors: RiskFactor[];
}
export interface UserBehaviorProfile {
    userId?: string;
    typicalHours: number[];
    commonLocations: string[];
    averageSessionDuration: number;
    commonEndpoints: string[];
    typicalUserAgents: string[];
    riskScore: number;
}
export interface SessionAnalysis {
    sessionId: string;
    duration: number;
    requestCount: number;
    uniqueEndpoints: number;
    errorRate: number;
    suspiciousPatterns: string[];
}
export interface RiskFactor {
    factor: string;
    impact: number;
    description: string;
}
export declare const ThreatDetectionConfigSchema: z.ZodObject<{
    models: z.ZodObject<{
        anomalyDetection: z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            isolationForest: z.ZodObject<{
                nTrees: z.ZodDefault<z.ZodNumber>;
                maxSamples: z.ZodDefault<z.ZodNumber>;
                contamination: z.ZodDefault<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                nTrees: number;
                maxSamples: number;
                contamination: number;
            }, {
                nTrees?: number | undefined;
                maxSamples?: number | undefined;
                contamination?: number | undefined;
            }>;
            autoencoder: z.ZodObject<{
                enabled: z.ZodDefault<z.ZodBoolean>;
                hiddenLayers: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
                threshold: z.ZodDefault<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                enabled: boolean;
                hiddenLayers: number[];
                threshold: number;
            }, {
                enabled?: boolean | undefined;
                hiddenLayers?: number[] | undefined;
                threshold?: number | undefined;
            }>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            isolationForest: {
                nTrees: number;
                maxSamples: number;
                contamination: number;
            };
            autoencoder: {
                enabled: boolean;
                hiddenLayers: number[];
                threshold: number;
            };
        }, {
            isolationForest: {
                nTrees?: number | undefined;
                maxSamples?: number | undefined;
                contamination?: number | undefined;
            };
            autoencoder: {
                enabled?: boolean | undefined;
                hiddenLayers?: number[] | undefined;
                threshold?: number | undefined;
            };
            enabled?: boolean | undefined;
        }>;
        behaviorAnalysis: z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            profileWindow: z.ZodDefault<z.ZodNumber>;
            sessionTimeout: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            profileWindow: number;
            sessionTimeout: number;
        }, {
            enabled?: boolean | undefined;
            profileWindow?: number | undefined;
            sessionTimeout?: number | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        anomalyDetection: {
            enabled: boolean;
            isolationForest: {
                nTrees: number;
                maxSamples: number;
                contamination: number;
            };
            autoencoder: {
                enabled: boolean;
                hiddenLayers: number[];
                threshold: number;
            };
        };
        behaviorAnalysis: {
            enabled: boolean;
            profileWindow: number;
            sessionTimeout: number;
        };
    }, {
        anomalyDetection: {
            isolationForest: {
                nTrees?: number | undefined;
                maxSamples?: number | undefined;
                contamination?: number | undefined;
            };
            autoencoder: {
                enabled?: boolean | undefined;
                hiddenLayers?: number[] | undefined;
                threshold?: number | undefined;
            };
            enabled?: boolean | undefined;
        };
        behaviorAnalysis: {
            enabled?: boolean | undefined;
            profileWindow?: number | undefined;
            sessionTimeout?: number | undefined;
        };
    }>;
    thresholds: z.ZodObject<{
        low: z.ZodDefault<z.ZodNumber>;
        medium: z.ZodDefault<z.ZodNumber>;
        high: z.ZodDefault<z.ZodNumber>;
        critical: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        medium: number;
        low: number;
        high: number;
        critical: number;
    }, {
        medium?: number | undefined;
        low?: number | undefined;
        high?: number | undefined;
        critical?: number | undefined;
    }>;
    features: z.ZodObject<{
        network: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        behavior: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        network: string[];
        behavior: string[];
    }, {
        network?: string[] | undefined;
        behavior?: string[] | undefined;
    }>;
    autoResponse: z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        actions: z.ZodObject<{
            critical: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            high: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            medium: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            low: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            medium: string[];
            low: string[];
            high: string[];
            critical: string[];
        }, {
            medium?: string[] | undefined;
            low?: string[] | undefined;
            high?: string[] | undefined;
            critical?: string[] | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        actions: {
            medium: string[];
            low: string[];
            high: string[];
            critical: string[];
        };
    }, {
        actions: {
            medium?: string[] | undefined;
            low?: string[] | undefined;
            high?: string[] | undefined;
            critical?: string[] | undefined;
        };
        enabled?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    models: {
        anomalyDetection: {
            enabled: boolean;
            isolationForest: {
                nTrees: number;
                maxSamples: number;
                contamination: number;
            };
            autoencoder: {
                enabled: boolean;
                hiddenLayers: number[];
                threshold: number;
            };
        };
        behaviorAnalysis: {
            enabled: boolean;
            profileWindow: number;
            sessionTimeout: number;
        };
    };
    thresholds: {
        medium: number;
        low: number;
        high: number;
        critical: number;
    };
    features: {
        network: string[];
        behavior: string[];
    };
    autoResponse: {
        enabled: boolean;
        actions: {
            medium: string[];
            low: string[];
            high: string[];
            critical: string[];
        };
    };
}, {
    models: {
        anomalyDetection: {
            isolationForest: {
                nTrees?: number | undefined;
                maxSamples?: number | undefined;
                contamination?: number | undefined;
            };
            autoencoder: {
                enabled?: boolean | undefined;
                hiddenLayers?: number[] | undefined;
                threshold?: number | undefined;
            };
            enabled?: boolean | undefined;
        };
        behaviorAnalysis: {
            enabled?: boolean | undefined;
            profileWindow?: number | undefined;
            sessionTimeout?: number | undefined;
        };
    };
    thresholds: {
        medium?: number | undefined;
        low?: number | undefined;
        high?: number | undefined;
        critical?: number | undefined;
    };
    features: {
        network?: string[] | undefined;
        behavior?: string[] | undefined;
    };
    autoResponse: {
        actions: {
            medium?: string[] | undefined;
            low?: string[] | undefined;
            high?: string[] | undefined;
            critical?: string[] | undefined;
        };
        enabled?: boolean | undefined;
    };
}>;
export type ThreatDetectionConfig = z.infer<typeof ThreatDetectionConfigSchema>;
/**
 * Main Security Threat Detection System
 */
export declare class SecurityThreatDetectionSystem {
    private config;
    private isolationForest;
    private autoencoder?;
    private userProfiles;
    private sessionData;
    private eventHistory;
    constructor(config?: Partial<ThreatDetectionConfig>);
    /**
     * Train the ML models with historical data
     */
    train(historicalEvents: SecurityEvent[]): Promise<void>;
    /**
     * Analyze a security event for threats
     */
    analyzeEvent(event: SecurityEvent): Promise<ThreatDetectionResult>;
    /**
     * Extract numerical features from a security event
     */
    private extractFeatures;
    /**
     * Detect anomalies using ML models
     */
    private detectAnomalies;
    /**
     * Analyze behavioral patterns
     */
    private analyzeBehavior;
    /**
     * Detect specific threat patterns
     */
    private detectThreatPatterns;
    /**
     * Build or update user behavioral profile
     */
    private buildOrUpdateUserProfile;
    /**
     * Calculate overall threat score
     */
    private calculateThreatScore;
    /**
     * Determine threat level based on score
     */
    private determineThreatLevel;
    /**
     * Generate security recommendations
     */
    private generateRecommendations;
    /**
     * Execute automated security actions
     */
    private executeAutoActions;
    private normalizeValue;
    private calculateRequestRate;
    private calculateGeoRisk;
    private calculateUserAgentRisk;
    private calculateEndpointRisk;
    private calculateSessionRisk;
    private calculateLocationRisk;
    private featureToObject;
    private detectSQLInjection;
    private detectXSS;
    private detectBruteForce;
    private detectDDoS;
    private detectDataExfiltration;
    private buildUserProfiles;
    private analyzeUserEvents;
    private groupEventsBySessions;
    private calculateBaselineRiskScore;
    private calculateUserRiskScore;
    private updateSessionData;
    private analyzeSession;
    private calculateRiskFactors;
    private blockIP;
    private applyRateLimit;
    private alertAdmin;
    private alertSecurity;
    private createIncident;
    private increaseMonitoring;
    private logDetailed;
    private logWarning;
    private logInfo;
}
/**
 * Real-time threat monitoring service
 */
export declare class RealTimeThreatMonitor {
    private detectionSystem;
    private eventQueue;
    private isProcessing;
    private processingInterval;
    constructor(detectionSystem: SecurityThreatDetectionSystem);
    start(processingIntervalMs?: number): void;
    stop(): void;
    addEvent(event: SecurityEvent): void;
    private processEventQueue;
}
export default SecurityThreatDetectionSystem;
