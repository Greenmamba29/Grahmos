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

import { Matrix } from 'ml-matrix';
import * as tf from '@tensorflow/tfjs-node';
import { z } from 'zod';

// Types and Schemas
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

// Configuration Schema
export const ThreatDetectionConfigSchema = z.object({
  models: z.object({
    anomalyDetection: z.object({
      enabled: z.boolean().default(true),
      isolationForest: z.object({
        nTrees: z.number().default(100),
        maxSamples: z.number().default(256),
        contamination: z.number().default(0.1)
      }),
      autoencoder: z.object({
        enabled: z.boolean().default(true),
        hiddenLayers: z.array(z.number()).default([32, 16, 8, 16, 32]),
        threshold: z.number().default(0.95)
      })
    }),
    behaviorAnalysis: z.object({
      enabled: z.boolean().default(true),
      profileWindow: z.number().default(30), // days
      sessionTimeout: z.number().default(30 * 60 * 1000) // 30 minutes
    })
  }),
  thresholds: z.object({
    low: z.number().default(0.3),
    medium: z.number().default(0.6),
    high: z.number().default(0.8),
    critical: z.number().default(0.95)
  }),
  features: z.object({
    network: z.array(z.string()).default([
      'requestRate', 'responseTime', 'errorRate', 'dataSize',
      'uniqueEndpoints', 'geoDistance', 'timeOfDay'
    ]),
    behavior: z.array(z.string()).default([
      'sessionDuration', 'userAgentVariance', 'locationVariance',
      'endpointDiversity', 'requestPattern'
    ])
  }),
  autoResponse: z.object({
    enabled: z.boolean().default(true),
    actions: z.object({
      critical: z.array(z.string()).default(['block_ip', 'alert_admin', 'create_incident']),
      high: z.array(z.string()).default(['rate_limit', 'alert_security', 'log_detailed']),
      medium: z.array(z.string()).default(['increase_monitoring', 'log_warning']),
      low: z.array(z.string()).default(['log_info'])
    })
  })
});

export type ThreatDetectionConfig = z.infer<typeof ThreatDetectionConfigSchema>;

/**
 * Isolation Forest implementation for anomaly detection
 */
class IsolationForest {
  private trees: IsolationTree[] = [];
  private nTrees: number;
  private maxSamples: number;

  constructor(nTrees: number = 100, maxSamples: number = 256) {
    this.nTrees = nTrees;
    this.maxSamples = maxSamples;
  }

  fit(data: number[][]): void {
    this.trees = [];
    
    for (let i = 0; i < this.nTrees; i++) {
      const sampleSize = Math.min(this.maxSamples, data.length);
      const sample = this.sampleData(data, sampleSize);
      const tree = new IsolationTree();
      tree.fit(sample);
      this.trees.push(tree);
    }
  }

  predict(data: number[][]): number[] {
    return data.map(point => this.scorePoint(point));
  }

  private scorePoint(point: number[]): number {
    if (this.trees.length === 0) return 0;

    const avgDepth = this.trees.reduce((sum, tree) => {
      return sum + tree.pathLength(point);
    }, 0) / this.trees.length;

    // Normalize score to [0, 1] where higher values indicate anomalies
    const c = this.cValue(this.maxSamples);
    return Math.pow(2, -avgDepth / c);
  }

  private sampleData(data: number[][], sampleSize: number): number[][] {
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, sampleSize);
  }

  private cValue(n: number): number {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
  }
}

/**
 * Individual tree in the Isolation Forest
 */
class IsolationTree {
  private root: TreeNode | null = null;

  fit(data: number[][]): void {
    this.root = this.buildTree(data, 0, Math.ceil(Math.log2(data.length)));
  }

  pathLength(point: number[]): number {
    return this.root ? this.getPathLength(point, this.root, 0) : 0;
  }

  private buildTree(data: number[][], depth: number, maxDepth: number): TreeNode | null {
    if (depth >= maxDepth || data.length <= 1) {
      return new TreeNode(data.length);
    }

    // Randomly select feature and split value
    const featureIdx = Math.floor(Math.random() * data[0].length);
    const values = data.map(row => row[featureIdx]);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    
    if (minVal === maxVal) {
      return new TreeNode(data.length);
    }

    const splitValue = minVal + Math.random() * (maxVal - minVal);
    
    const leftData = data.filter(row => row[featureIdx] < splitValue);
    const rightData = data.filter(row => row[featureIdx] >= splitValue);

    const node = new TreeNode();
    node.featureIdx = featureIdx;
    node.splitValue = splitValue;
    node.left = this.buildTree(leftData, depth + 1, maxDepth);
    node.right = this.buildTree(rightData, depth + 1, maxDepth);

    return node;
  }

  private getPathLength(point: number[], node: TreeNode, currentDepth: number): number {
    if (node.isLeaf()) {
      return currentDepth + this.cValue(node.size);
    }

    if (point[node.featureIdx!] < node.splitValue!) {
      return this.getPathLength(point, node.left!, currentDepth + 1);
    } else {
      return this.getPathLength(point, node.right!, currentDepth + 1);
    }
  }

  private cValue(n: number): number {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
  }
}

class TreeNode {
  featureIdx?: number;
  splitValue?: number;
  left?: TreeNode;
  right?: TreeNode;
  size: number;

  constructor(size: number = 0) {
    this.size = size;
  }

  isLeaf(): boolean {
    return this.left === undefined && this.right === undefined;
  }
}

/**
 * Deep Learning Autoencoder for advanced anomaly detection
 */
class AutoencoderAnomalyDetector {
  private model?: tf.LayersModel;
  private inputShape: number;
  private threshold: number = 0.95;

  constructor(inputShape: number, hiddenLayers: number[] = [32, 16, 8, 16, 32]) {
    this.inputShape = inputShape;
    this.buildModel(hiddenLayers);
  }

  private buildModel(hiddenLayers: number[]): void {
    const input = tf.input({ shape: [this.inputShape] });
    let x = input;

    // Encoder
    for (let i = 0; i < Math.floor(hiddenLayers.length / 2); i++) {
      x = tf.layers.dense({
        units: hiddenLayers[i],
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
      }).apply(x) as tf.SymbolicTensor;
      
      x = tf.layers.dropout({ rate: 0.2 }).apply(x) as tf.SymbolicTensor;
    }

    // Decoder
    for (let i = Math.floor(hiddenLayers.length / 2); i < hiddenLayers.length; i++) {
      x = tf.layers.dense({
        units: hiddenLayers[i],
        activation: 'relu'
      }).apply(x) as tf.SymbolicTensor;
    }

    // Output layer
    const output = tf.layers.dense({
      units: this.inputShape,
      activation: 'sigmoid'
    }).apply(x) as tf.SymbolicTensor;

    this.model = tf.model({ inputs: input, outputs: output });
    
    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });
  }

  async fit(data: number[][], epochs: number = 100): Promise<void> {
    if (!this.model) throw new Error('Model not initialized');

    const tensor = tf.tensor2d(data);
    
    await this.model.fit(tensor, tensor, {
      epochs,
      batchSize: 32,
      validationSplit: 0.2,
      shuffle: true,
      verbose: 0
    });

    tensor.dispose();
  }

  predict(data: number[][]): number[] {
    if (!this.model) throw new Error('Model not trained');

    const tensor = tf.tensor2d(data);
    const predictions = this.model.predict(tensor) as tf.Tensor;
    
    // Calculate reconstruction error
    const errors = tf.losses.meanSquaredError(tensor, predictions);
    const errorValues = Array.from(errors.dataSync());
    
    tensor.dispose();
    predictions.dispose();
    errors.dispose();

    return errorValues;
  }

  setThreshold(threshold: number): void {
    this.threshold = threshold;
  }
}

/**
 * Main Security Threat Detection System
 */
export class SecurityThreatDetectionSystem {
  private config: ThreatDetectionConfig;
  private isolationForest: IsolationForest;
  private autoencoder?: AutoencoderAnomalyDetector;
  private userProfiles: Map<string, UserBehaviorProfile> = new Map();
  private sessionData: Map<string, SecurityEvent[]> = new Map();
  private eventHistory: SecurityEvent[] = [];

  constructor(config: Partial<ThreatDetectionConfig> = {}) {
    this.config = ThreatDetectionConfigSchema.parse(config);
    this.isolationForest = new IsolationForest(
      this.config.models.anomalyDetection.isolationForest.nTrees,
      this.config.models.anomalyDetection.isolationForest.maxSamples
    );

    if (this.config.models.anomalyDetection.autoencoder.enabled) {
      this.autoencoder = new AutoencoderAnomalyDetector(
        this.config.features.network.length + this.config.features.behavior.length,
        this.config.models.anomalyDetection.autoencoder.hiddenLayers
      );
    }
  }

  /**
   * Train the ML models with historical data
   */
  async train(historicalEvents: SecurityEvent[]): Promise<void> {
    console.log(`Training threat detection models with ${historicalEvents.length} events`);

    // Store historical data
    this.eventHistory = historicalEvents;

    // Build user profiles
    this.buildUserProfiles(historicalEvents);

    // Extract features for training
    const features = historicalEvents.map(event => this.extractFeatures(event));
    
    // Train Isolation Forest
    this.isolationForest.fit(features);

    // Train Autoencoder if enabled
    if (this.autoencoder) {
      await this.autoencoder.fit(features);
    }

    console.log('Threat detection models training completed');
  }

  /**
   * Analyze a security event for threats
   */
  async analyzeEvent(event: SecurityEvent): Promise<ThreatDetectionResult> {
    // Store event
    this.eventHistory.push(event);
    this.updateSessionData(event);

    // Extract features
    const features = this.extractFeatures(event);

    // Run anomaly detection
    const anomalies = await this.detectAnomalies([features]);

    // Perform behavioral analysis
    const behaviorAnalysis = this.analyzeBehavior(event);

    // Detect specific threat patterns
    const threats = this.detectThreatPatterns(event);

    // Calculate overall threat score
    const score = this.calculateThreatScore(anomalies, behaviorAnalysis, threats);

    // Determine threat level
    const threatLevel = this.determineThreatLevel(score);

    // Generate recommendations
    const recommendations = this.generateRecommendations(threats, anomalies, behaviorAnalysis);

    // Determine auto actions
    const autoActions = this.config.autoResponse.enabled 
      ? this.config.autoResponse.actions[threatLevel.toLowerCase() as keyof typeof this.config.autoResponse.actions]
      : undefined;

    const result: ThreatDetectionResult = {
      eventId: event.id,
      threatLevel,
      score,
      threats,
      anomalies,
      behaviorAnalysis,
      recommendations,
      autoActions
    };

    // Execute auto actions if configured
    if (autoActions && autoActions.length > 0) {
      await this.executeAutoActions(event, result, autoActions);
    }

    return result;
  }

  /**
   * Extract numerical features from a security event
   */
  private extractFeatures(event: SecurityEvent): number[] {
    const features: number[] = [];

    // Network features
    features.push(
      this.normalizeValue(event.responseTime, 0, 10000), // Response time
      this.normalizeValue(event.dataSize, 0, 1000000), // Data size
      this.normalizeValue(event.statusCode, 200, 599), // Status code
      event.statusCode >= 400 ? 1 : 0, // Error indicator
      new Date(event.timestamp).getHours() / 24, // Time of day
      this.calculateRequestRate(event), // Request rate
      this.calculateGeoRisk(event) // Geographic risk
    );

    // Behavioral features
    const userProfile = event.userId ? this.userProfiles.get(event.userId) : undefined;
    features.push(
      this.calculateUserAgentRisk(event), // User agent risk
      this.calculateEndpointRisk(event), // Endpoint risk
      userProfile ? userProfile.riskScore : 0.5, // User risk score
      this.calculateSessionRisk(event), // Session risk
      this.calculateLocationRisk(event, userProfile) // Location risk
    );

    return features;
  }

  /**
   * Detect anomalies using ML models
   */
  private async detectAnomalies(features: number[][]): Promise<AnomalyResult[]> {
    const anomalies: AnomalyResult[] = [];

    // Isolation Forest anomaly detection
    const isolationScores = this.isolationForest.predict(features);
    if (isolationScores[0] > this.config.models.anomalyDetection.isolationForest.contamination) {
      anomalies.push({
        type: 'ml',
        score: isolationScores[0],
        threshold: this.config.models.anomalyDetection.isolationForest.contamination,
        description: 'Isolation Forest detected anomalous behavior pattern',
        features: this.featureToObject(features[0])
      });
    }

    // Autoencoder anomaly detection
    if (this.autoencoder) {
      const reconstructionErrors = this.autoencoder.predict(features);
      if (reconstructionErrors[0] > this.config.models.anomalyDetection.autoencoder.threshold) {
        anomalies.push({
          type: 'ml',
          score: reconstructionErrors[0],
          threshold: this.config.models.anomalyDetection.autoencoder.threshold,
          description: 'Autoencoder detected unusual feature patterns',
          features: this.featureToObject(features[0])
        });
      }
    }

    return anomalies;
  }

  /**
   * Analyze behavioral patterns
   */
  private analyzeBehavior(event: SecurityEvent): BehaviorAnalysis {
    const userProfile = this.buildOrUpdateUserProfile(event);
    const sessionAnalysis = this.analyzeSession(event);
    const riskFactors = this.calculateRiskFactors(event, userProfile);

    return {
      userProfile,
      sessionAnalysis,
      riskFactors
    };
  }

  /**
   * Detect specific threat patterns
   */
  private detectThreatPatterns(event: SecurityEvent): ThreatType[] {
    const threats: ThreatType[] = [];

    // SQL Injection detection
    if (this.detectSQLInjection(event)) {
      threats.push({
        type: 'sql_injection',
        confidence: 0.8,
        description: 'Potential SQL injection attempt detected',
        indicators: ['suspicious_sql_patterns', 'malicious_payload']
      });
    }

    // XSS detection
    if (this.detectXSS(event)) {
      threats.push({
        type: 'xss',
        confidence: 0.7,
        description: 'Potential Cross-Site Scripting attack detected',
        indicators: ['script_tags', 'javascript_payload']
      });
    }

    // Brute force detection
    if (this.detectBruteForce(event)) {
      threats.push({
        type: 'brute_force',
        confidence: 0.9,
        description: 'Potential brute force attack detected',
        indicators: ['high_failure_rate', 'repeated_attempts']
      });
    }

    // DDoS detection
    if (this.detectDDoS(event)) {
      threats.push({
        type: 'ddos',
        confidence: 0.85,
        description: 'Potential DDoS attack detected',
        indicators: ['high_request_rate', 'suspicious_patterns']
      });
    }

    // Data exfiltration detection
    if (this.detectDataExfiltration(event)) {
      threats.push({
        type: 'data_exfiltration',
        confidence: 0.75,
        description: 'Potential data exfiltration detected',
        indicators: ['large_data_transfer', 'unusual_endpoints']
      });
    }

    return threats;
  }

  /**
   * Build or update user behavioral profile
   */
  private buildOrUpdateUserProfile(event: SecurityEvent): UserBehaviorProfile {
    if (!event.userId) {
      return {
        typicalHours: [],
        commonLocations: [],
        averageSessionDuration: 0,
        commonEndpoints: [],
        typicalUserAgents: [],
        riskScore: 0.5
      };
    }

    let profile = this.userProfiles.get(event.userId);
    
    if (!profile) {
      profile = {
        userId: event.userId,
        typicalHours: [],
        commonLocations: [],
        averageSessionDuration: 0,
        commonEndpoints: [],
        typicalUserAgents: [],
        riskScore: 0
      };
    }

    // Update profile with new event data
    const hour = new Date(event.timestamp).getHours();
    if (!profile.typicalHours.includes(hour)) {
      profile.typicalHours.push(hour);
    }

    if (event.geoLocation) {
      const location = `${event.geoLocation.country}:${event.geoLocation.city}`;
      if (!profile.commonLocations.includes(location)) {
        profile.commonLocations.push(location);
      }
    }

    if (!profile.commonEndpoints.includes(event.endpoint)) {
      profile.commonEndpoints.push(event.endpoint);
    }

    if (!profile.typicalUserAgents.includes(event.userAgent)) {
      profile.typicalUserAgents.push(event.userAgent);
    }

    // Calculate risk score based on deviations
    profile.riskScore = this.calculateUserRiskScore(event, profile);

    this.userProfiles.set(event.userId, profile);
    return profile;
  }

  /**
   * Calculate overall threat score
   */
  private calculateThreatScore(
    anomalies: AnomalyResult[],
    behaviorAnalysis: BehaviorAnalysis,
    threats: ThreatType[]
  ): number {
    let score = 0;

    // Weight anomaly scores
    const anomalyScore = anomalies.reduce((sum, anomaly) => sum + anomaly.score, 0) / Math.max(anomalies.length, 1);
    score += anomalyScore * 0.3;

    // Weight behavior risk
    score += behaviorAnalysis.userProfile.riskScore * 0.2;

    // Weight session risk
    const sessionRisk = behaviorAnalysis.riskFactors.reduce((sum, factor) => sum + factor.impact, 0) / Math.max(behaviorAnalysis.riskFactors.length, 1);
    score += sessionRisk * 0.2;

    // Weight threat confidence
    const threatScore = threats.reduce((sum, threat) => sum + threat.confidence, 0) / Math.max(threats.length, 1);
    score += threatScore * 0.3;

    return Math.min(score, 1);
  }

  /**
   * Determine threat level based on score
   */
  private determineThreatLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= this.config.thresholds.critical) return 'CRITICAL';
    if (score >= this.config.thresholds.high) return 'HIGH';
    if (score >= this.config.thresholds.medium) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Generate security recommendations
   */
  private generateRecommendations(
    threats: ThreatType[],
    anomalies: AnomalyResult[],
    behaviorAnalysis: BehaviorAnalysis
  ): string[] {
    const recommendations: string[] = [];

    if (threats.some(t => t.type === 'sql_injection')) {
      recommendations.push('Enable SQL injection protection and input validation');
      recommendations.push('Review database query parameterization');
    }

    if (threats.some(t => t.type === 'xss')) {
      recommendations.push('Implement Content Security Policy (CSP)');
      recommendations.push('Enable XSS protection headers');
    }

    if (threats.some(t => t.type === 'brute_force')) {
      recommendations.push('Implement account lockout policies');
      recommendations.push('Enable CAPTCHA for repeated failed attempts');
    }

    if (threats.some(t => t.type === 'ddos')) {
      recommendations.push('Configure rate limiting and traffic shaping');
      recommendations.push('Consider DDoS protection services');
    }

    if (anomalies.length > 0) {
      recommendations.push('Investigate unusual behavioral patterns');
      recommendations.push('Review access logs for the affected time period');
    }

    if (behaviorAnalysis.userProfile.riskScore > 0.7) {
      recommendations.push('Require additional authentication for high-risk users');
      recommendations.push('Monitor user activity more closely');
    }

    return recommendations;
  }

  /**
   * Execute automated security actions
   */
  private async executeAutoActions(
    event: SecurityEvent,
    result: ThreatDetectionResult,
    actions: string[]
  ): Promise<void> {
    for (const action of actions) {
      try {
        switch (action) {
          case 'block_ip':
            await this.blockIP(event.ip);
            break;
          case 'rate_limit':
            await this.applyRateLimit(event.ip);
            break;
          case 'alert_admin':
            await this.alertAdmin(event, result);
            break;
          case 'alert_security':
            await this.alertSecurity(event, result);
            break;
          case 'create_incident':
            await this.createIncident(event, result);
            break;
          case 'increase_monitoring':
            await this.increaseMonitoring(event);
            break;
          case 'log_detailed':
            this.logDetailed(event, result);
            break;
          case 'log_warning':
            this.logWarning(event, result);
            break;
          case 'log_info':
            this.logInfo(event, result);
            break;
        }
      } catch (error) {
        console.error(`Failed to execute auto action ${action}:`, error);
      }
    }
  }

  // Helper methods for feature extraction and threat detection
  private normalizeValue(value: number, min: number, max: number): number {
    return (value - min) / (max - min);
  }

  private calculateRequestRate(event: SecurityEvent): number {
    const timeWindow = 60000; // 1 minute
    const recentEvents = this.eventHistory.filter(e => 
      e.ip === event.ip && 
      event.timestamp - e.timestamp < timeWindow
    );
    return recentEvents.length / 60; // requests per second
  }

  private calculateGeoRisk(event: SecurityEvent): number {
    // Simple geo-risk based on known high-risk countries
    const highRiskCountries = ['CN', 'RU', 'KP', 'IR'];
    if (event.geoLocation && highRiskCountries.includes(event.geoLocation.country)) {
      return 0.8;
    }
    return 0.2;
  }

  private calculateUserAgentRisk(event: SecurityEvent): number {
    // Check for suspicious user agent patterns
    const suspiciousPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i,
      /curl/i, /wget/i, /python/i, /java/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(event.userAgent)) ? 0.7 : 0.2;
  }

  private calculateEndpointRisk(event: SecurityEvent): number {
    const highRiskEndpoints = ['/admin', '/api/internal', '/debug', '/.env'];
    return highRiskEndpoints.some(endpoint => event.endpoint.includes(endpoint)) ? 0.8 : 0.2;
  }

  private calculateSessionRisk(event: SecurityEvent): number {
    if (!event.sessionId) return 0.5;
    
    const sessionEvents = this.sessionData.get(event.sessionId) || [];
    const errorRate = sessionEvents.filter(e => e.statusCode >= 400).length / Math.max(sessionEvents.length, 1);
    return errorRate > 0.5 ? 0.8 : 0.2;
  }

  private calculateLocationRisk(event: SecurityEvent, userProfile?: UserBehaviorProfile): number {
    if (!event.geoLocation || !userProfile) return 0.5;
    
    const currentLocation = `${event.geoLocation.country}:${event.geoLocation.city}`;
    return userProfile.commonLocations.includes(currentLocation) ? 0.1 : 0.9;
  }

  private featureToObject(features: number[]): Record<string, number> {
    const obj: Record<string, number> = {};
    const featureNames = [...this.config.features.network, ...this.config.features.behavior];
    
    features.forEach((value, index) => {
      if (index < featureNames.length) {
        obj[featureNames[index]] = value;
      }
    });
    
    return obj;
  }

  // Threat pattern detection methods
  private detectSQLInjection(event: SecurityEvent): boolean {
    const sqlPatterns = [
      /('|('')|;|\/\*|\*\/|xp_|sp_)/i,
      /(union|select|insert|update|delete|drop|create|alter|exec|execute)/i,
      /(\-\-|#|\/\*|\*\/)/,
      /(or|and)\s+\d+\s*=\s*\d+/i
    ];
    
    const payload = JSON.stringify(event.payload || {}) + event.endpoint;
    return sqlPatterns.some(pattern => pattern.test(payload));
  }

  private detectXSS(event: SecurityEvent): boolean {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe[^>]*>/gi,
      /eval\s*\(/i,
      /expression\s*\(/i
    ];
    
    const payload = JSON.stringify(event.payload || {}) + event.endpoint;
    return xssPatterns.some(pattern => pattern.test(payload));
  }

  private detectBruteForce(event: SecurityEvent): boolean {
    const timeWindow = 300000; // 5 minutes
    const recentFailures = this.eventHistory.filter(e => 
      e.ip === event.ip && 
      e.statusCode === 401 &&
      event.timestamp - e.timestamp < timeWindow
    );
    
    return recentFailures.length > 10;
  }

  private detectDDoS(event: SecurityEvent): boolean {
    const timeWindow = 60000; // 1 minute
    const recentRequests = this.eventHistory.filter(e => 
      e.ip === event.ip && 
      event.timestamp - e.timestamp < timeWindow
    );
    
    return recentRequests.length > 100; // More than 100 requests per minute
  }

  private detectDataExfiltration(event: SecurityEvent): boolean {
    return event.dataSize > 10000000 || // Large data transfer (10MB+)
           event.endpoint.includes('/api/export') ||
           event.endpoint.includes('/download');
  }

  // User profile analysis methods
  private buildUserProfiles(events: SecurityEvent[]): void {
    const userEvents = new Map<string, SecurityEvent[]>();
    
    events.forEach(event => {
      if (event.userId) {
        if (!userEvents.has(event.userId)) {
          userEvents.set(event.userId, []);
        }
        userEvents.get(event.userId)!.push(event);
      }
    });

    userEvents.forEach((events, userId) => {
      const profile = this.analyzeUserEvents(userId, events);
      this.userProfiles.set(userId, profile);
    });
  }

  private analyzeUserEvents(userId: string, events: SecurityEvent[]): UserBehaviorProfile {
    const hours = events.map(e => new Date(e.timestamp).getHours());
    const locations = events
      .filter(e => e.geoLocation)
      .map(e => `${e.geoLocation!.country}:${e.geoLocation!.city}`);
    
    const sessions = this.groupEventsBySessions(events);
    const avgSessionDuration = sessions.reduce((sum, session) => {
      const duration = Math.max(...session.map(e => e.timestamp)) - Math.min(...session.map(e => e.timestamp));
      return sum + duration;
    }, 0) / Math.max(sessions.length, 1);

    return {
      userId,
      typicalHours: [...new Set(hours)],
      commonLocations: [...new Set(locations)],
      averageSessionDuration,
      commonEndpoints: [...new Set(events.map(e => e.endpoint))],
      typicalUserAgents: [...new Set(events.map(e => e.userAgent))],
      riskScore: this.calculateBaselineRiskScore(events)
    };
  }

  private groupEventsBySessions(events: SecurityEvent[]): SecurityEvent[][] {
    const sessions: SecurityEvent[][] = [];
    const sessionTimeout = this.config.models.behaviorAnalysis.sessionTimeout;
    
    events.sort((a, b) => a.timestamp - b.timestamp);
    
    let currentSession: SecurityEvent[] = [];
    let lastTimestamp = 0;
    
    events.forEach(event => {
      if (event.timestamp - lastTimestamp > sessionTimeout) {
        if (currentSession.length > 0) {
          sessions.push(currentSession);
        }
        currentSession = [event];
      } else {
        currentSession.push(event);
      }
      lastTimestamp = event.timestamp;
    });
    
    if (currentSession.length > 0) {
      sessions.push(currentSession);
    }
    
    return sessions;
  }

  private calculateBaselineRiskScore(events: SecurityEvent[]): number {
    const errorRate = events.filter(e => e.statusCode >= 400).length / Math.max(events.length, 1);
    const uniqueIPs = new Set(events.map(e => e.ip)).size;
    const uniqueUserAgents = new Set(events.map(e => e.userAgent)).size;
    
    let risk = 0;
    
    // Higher error rate increases risk
    risk += errorRate * 0.3;
    
    // Multiple IPs increases risk
    if (uniqueIPs > 1) risk += 0.2;
    
    // Multiple user agents increases risk
    if (uniqueUserAgents > 2) risk += 0.1;
    
    return Math.min(risk, 1);
  }

  private calculateUserRiskScore(event: SecurityEvent, profile: UserBehaviorProfile): number {
    let risk = profile.riskScore || 0;
    
    // Check time-based anomalies
    const hour = new Date(event.timestamp).getHours();
    if (!profile.typicalHours.includes(hour)) {
      risk += 0.2;
    }
    
    // Check location anomalies
    if (event.geoLocation) {
      const location = `${event.geoLocation.country}:${event.geoLocation.city}`;
      if (!profile.commonLocations.includes(location)) {
        risk += 0.3;
      }
    }
    
    // Check user agent anomalies
    if (!profile.typicalUserAgents.includes(event.userAgent)) {
      risk += 0.1;
    }
    
    // Check endpoint anomalies
    if (!profile.commonEndpoints.includes(event.endpoint)) {
      risk += 0.1;
    }
    
    return Math.min(risk, 1);
  }

  private updateSessionData(event: SecurityEvent): void {
    if (event.sessionId) {
      if (!this.sessionData.has(event.sessionId)) {
        this.sessionData.set(event.sessionId, []);
      }
      this.sessionData.get(event.sessionId)!.push(event);
    }
  }

  private analyzeSession(event: SecurityEvent): SessionAnalysis {
    if (!event.sessionId) {
      return {
        sessionId: 'unknown',
        duration: 0,
        requestCount: 0,
        uniqueEndpoints: 0,
        errorRate: 0,
        suspiciousPatterns: []
      };
    }

    const sessionEvents = this.sessionData.get(event.sessionId) || [];
    const timestamps = sessionEvents.map(e => e.timestamp);
    const duration = timestamps.length > 1 ? Math.max(...timestamps) - Math.min(...timestamps) : 0;
    const errorRate = sessionEvents.filter(e => e.statusCode >= 400).length / Math.max(sessionEvents.length, 1);
    const uniqueEndpoints = new Set(sessionEvents.map(e => e.endpoint)).size;
    
    const suspiciousPatterns: string[] = [];
    if (errorRate > 0.5) suspiciousPatterns.push('high_error_rate');
    if (uniqueEndpoints > 20) suspiciousPatterns.push('endpoint_scanning');
    if (duration > 3600000) suspiciousPatterns.push('unusually_long_session'); // > 1 hour

    return {
      sessionId: event.sessionId,
      duration,
      requestCount: sessionEvents.length,
      uniqueEndpoints,
      errorRate,
      suspiciousPatterns
    };
  }

  private calculateRiskFactors(event: SecurityEvent, profile: UserBehaviorProfile): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // Time-based risk
    const hour = new Date(event.timestamp).getHours();
    if (hour < 6 || hour > 22) {
      factors.push({
        factor: 'off_hours_access',
        impact: 0.3,
        description: 'Access during unusual hours'
      });
    }

    // Geographic risk
    if (event.geoLocation && profile.commonLocations.length > 0) {
      const location = `${event.geoLocation.country}:${event.geoLocation.city}`;
      if (!profile.commonLocations.includes(location)) {
        factors.push({
          factor: 'unusual_location',
          impact: 0.4,
          description: 'Access from unusual geographic location'
        });
      }
    }

    // User agent risk
    if (!profile.typicalUserAgents.includes(event.userAgent)) {
      factors.push({
        factor: 'new_user_agent',
        impact: 0.2,
        description: 'Using new or unusual user agent'
      });
    }

    // Endpoint risk
    const sensitiveEndpoints = ['/admin', '/api/internal', '/config'];
    if (sensitiveEndpoints.some(endpoint => event.endpoint.includes(endpoint))) {
      factors.push({
        factor: 'sensitive_endpoint',
        impact: 0.5,
        description: 'Accessing sensitive endpoint'
      });
    }

    return factors;
  }

  // Auto-action methods (stub implementations - would integrate with actual security infrastructure)
  private async blockIP(ip: string): Promise<void> {
    console.log(`[AUTO-ACTION] Blocking IP: ${ip}`);
    // Implementation would integrate with firewall/WAF
  }

  private async applyRateLimit(ip: string): Promise<void> {
    console.log(`[AUTO-ACTION] Applying rate limit to IP: ${ip}`);
    // Implementation would configure rate limiting
  }

  private async alertAdmin(event: SecurityEvent, result: ThreatDetectionResult): Promise<void> {
    console.log(`[AUTO-ACTION] Admin alert for event ${event.id}: ${result.threatLevel} threat detected`);
    // Implementation would send alerts via email/Slack/etc.
  }

  private async alertSecurity(event: SecurityEvent, result: ThreatDetectionResult): Promise<void> {
    console.log(`[AUTO-ACTION] Security team alert for event ${event.id}: ${result.threatLevel} threat detected`);
    // Implementation would notify security team
  }

  private async createIncident(event: SecurityEvent, result: ThreatDetectionResult): Promise<void> {
    console.log(`[AUTO-ACTION] Creating incident for event ${event.id}`);
    // Implementation would integrate with incident response system
  }

  private async increaseMonitoring(event: SecurityEvent): Promise<void> {
    console.log(`[AUTO-ACTION] Increasing monitoring for IP: ${event.ip}`);
    // Implementation would adjust monitoring levels
  }

  private logDetailed(event: SecurityEvent, result: ThreatDetectionResult): void {
    console.log(`[DETAILED] Threat detected:`, { event, result });
  }

  private logWarning(event: SecurityEvent, result: ThreatDetectionResult): void {
    console.warn(`[WARNING] Potential threat in event ${event.id}: ${result.threatLevel}`);
  }

  private logInfo(event: SecurityEvent, result: ThreatDetectionResult): void {
    console.info(`[INFO] Security event analyzed: ${event.id} - ${result.threatLevel}`);
  }
}

/**
 * Real-time threat monitoring service
 */
export class RealTimeThreatMonitor {
  private detectionSystem: SecurityThreatDetectionSystem;
  private eventQueue: SecurityEvent[] = [];
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(detectionSystem: SecurityThreatDetectionSystem) {
    this.detectionSystem = detectionSystem;
  }

  start(processingIntervalMs: number = 1000): void {
    console.log('Starting real-time threat monitoring');
    
    this.processingInterval = setInterval(() => {
      this.processEventQueue();
    }, processingIntervalMs);
  }

  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    console.log('Stopped real-time threat monitoring');
  }

  addEvent(event: SecurityEvent): void {
    this.eventQueue.push(event);
  }

  private async processEventQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    try {
      const events = this.eventQueue.splice(0, 10); // Process up to 10 events at a time
      
      for (const event of events) {
        try {
          const result = await this.detectionSystem.analyzeEvent(event);
          
          if (result.threatLevel === 'CRITICAL' || result.threatLevel === 'HIGH') {
            console.warn(`[REAL-TIME] ${result.threatLevel} threat detected:`, {
              eventId: event.id,
              threats: result.threats.map(t => t.type),
              score: result.score
            });
          }
        } catch (error) {
          console.error(`Error processing event ${event.id}:`, error);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

export default SecurityThreatDetectionSystem;
