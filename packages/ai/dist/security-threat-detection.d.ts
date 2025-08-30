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
export declare const ThreatDetectionConfigSchema: any;
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
