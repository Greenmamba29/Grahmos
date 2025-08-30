/**
 * Grahmos Predictive Analytics and Insights Engine
 * Phase 12: Advanced AI/ML Integration
 *
 * Features:
 * - User behavior analysis and pattern recognition
 * - Content recommendation system
 * - Usage pattern prediction
 * - Business intelligence dashboards
 * - Engagement optimization
 * - Churn prediction
 * - Content performance analysis
 * - Anomaly detection in user behavior
 */
export interface UserBehaviorEvent {
    userId: string;
    sessionId: string;
    timestamp: Date;
    eventType: EventType;
    entityType: string;
    entityId: string;
    metadata: EventMetadata;
    context: EventContext;
}
export interface EventMetadata {
    duration?: number;
    scrollDepth?: number;
    clickPosition?: {
        x: number;
        y: number;
    };
    searchQuery?: string;
    resultPosition?: number;
    rating?: number;
    tags?: string[];
    category?: string;
    [key: string]: any;
}
export interface EventContext {
    userAgent: string;
    ipAddress: string;
    referrer?: string;
    sessionDuration: number;
    deviceType: 'desktop' | 'tablet' | 'mobile';
    platform: string;
    location?: {
        country: string;
        city?: string;
        timezone: string;
    };
}
export declare enum EventType {
    PAGE_VIEW = "PAGE_VIEW",
    SEARCH = "SEARCH",
    DOCUMENT_VIEW = "DOCUMENT_VIEW",
    DOCUMENT_DOWNLOAD = "DOCUMENT_DOWNLOAD",
    DOCUMENT_SHARE = "DOCUMENT_SHARE",
    BOOKMARK_ADD = "BOOKMARK_ADD",
    BOOKMARK_REMOVE = "BOOKMARK_REMOVE",
    RATING = "RATING",
    COMMENT = "COMMENT",
    TAG_ADD = "TAG_ADD",
    FILTER_APPLY = "FILTER_APPLY",
    SESSION_START = "SESSION_START",
    SESSION_END = "SESSION_END",
    UPLOAD = "UPLOAD",
    DELETE = "DELETE",
    EDIT = "EDIT",
    LOGIN = "LOGIN",
    LOGOUT = "LOGOUT",
    FEATURE_USE = "FEATURE_USE",
    ERROR = "ERROR"
}
export interface UserProfile {
    userId: string;
    createdAt: Date;
    lastActiveAt: Date;
    totalSessions: number;
    totalEvents: number;
    averageSessionDuration: number;
    preferredCategories: string[];
    preferredTags: string[];
    searchPatterns: SearchPattern[];
    engagementScore: number;
    churnRisk: number;
    segments: UserSegment[];
    preferences: UserPreferences;
    behaviorVectors: number[];
}
export interface SearchPattern {
    query: string;
    frequency: number;
    lastUsed: Date;
    successRate: number;
    avgResultsViewed: number;
}
export interface UserSegment {
    name: string;
    confidence: number;
    characteristics: string[];
    predictions: SegmentPrediction[];
}
export interface SegmentPrediction {
    metric: string;
    value: number;
    confidence: number;
    timeframe: string;
}
export interface UserPreferences {
    contentTypes: Record<string, number>;
    categories: Record<string, number>;
    languages: Record<string, number>;
    timeOfDay: Record<string, number>;
    sessionLength: 'short' | 'medium' | 'long';
    interactionStyle: 'browser' | 'searcher' | 'contributor';
}
export interface Recommendation {
    type: RecommendationType;
    entityId: string;
    entityType: string;
    title: string;
    description: string;
    confidence: number;
    reasoning: string[];
    metadata: RecommendationMetadata;
    expiresAt?: Date;
}
export interface RecommendationMetadata {
    category: string;
    tags: string[];
    popularity: number;
    recency: number;
    relevanceScore: number;
    diversityScore: number;
    noveltyScore: number;
}
export declare enum RecommendationType {
    CONTENT = "CONTENT",
    SEARCH = "SEARCH",
    USER = "USER",
    TAG = "TAG",
    CATEGORY = "CATEGORY",
    FEATURE = "FEATURE",
    WORKFLOW = "WORKFLOW"
}
export interface AnalyticsInsight {
    id: string;
    type: InsightType;
    title: string;
    description: string;
    impact: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    data: InsightData;
    recommendations: string[];
    createdAt: Date;
    validUntil?: Date;
}
export declare enum InsightType {
    USAGE_TREND = "USAGE_TREND",
    CONTENT_PERFORMANCE = "CONTENT_PERFORMANCE",
    USER_BEHAVIOR = "USER_BEHAVIOR",
    SEARCH_PATTERNS = "SEARCH_PATTERNS",
    ENGAGEMENT_ANOMALY = "ENGAGEMENT_ANOMALY",
    CHURN_PREDICTION = "CHURN_PREDICTION",
    FEATURE_ADOPTION = "FEATURE_ADOPTION",
    BUSINESS_OPPORTUNITY = "BUSINESS_OPPORTUNITY"
}
export interface InsightData {
    metrics: Record<string, number>;
    trends: TrendData[];
    segments: SegmentAnalysis[];
    comparisons: ComparisonData[];
    predictions: PredictionData[];
}
export interface TrendData {
    metric: string;
    values: {
        timestamp: Date;
        value: number;
    }[];
    trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    changePercent: number;
    significance: number;
}
export interface SegmentAnalysis {
    segment: string;
    size: number;
    characteristics: Record<string, any>;
    performance: Record<string, number>;
    insights: string[];
}
export interface ComparisonData {
    metric: string;
    periods: {
        name: string;
        value: number;
        change?: number;
    }[];
    significance: number;
}
export interface PredictionData {
    metric: string;
    currentValue: number;
    predictedValue: number;
    confidence: number;
    timeframe: string;
    factors: {
        factor: string;
        importance: number;
    }[];
}
export declare class UserBehaviorAnalyzer {
    private events;
    private userProfiles;
    constructor();
    private initializeAnalyzer;
    recordEvent(event: UserBehaviorEvent): void;
    private updateUserProfile;
    private createNewUserProfile;
    private updateSearchPattern;
    private calculateEngagementScore;
    private calculateBehaviorVectors;
    private getHourlyActivity;
    private getClickThroughRate;
    private getShareRate;
    private getBookmarkRate;
    private getRatingActivity;
    private getUploadActivity;
    private getCommentActivity;
    private getDownloadActivity;
    private getDeviceUsage;
    private getMonthlyActivity;
    private getActivityTrend;
    private analyzeUserBehavior;
    private performUserSegmentation;
    private kMeansCluster;
    private initializeCentroids;
    private euclideanDistance;
    private calculateCentroid;
    private getSegmentName;
    private getSegmentCharacteristics;
    private generateSegmentPredictions;
    private getSegmentMultiplier;
    private calculateChurnRisk;
    private updateContentPreferences;
    getUserProfile(userId: string): UserProfile | null;
    getUsersBySegment(segmentName: string): UserProfile[];
    getChurnRiskUsers(threshold?: number): UserProfile[];
    getEngagementInsights(): AnalyticsInsight[];
}
export declare class RecommendationEngine {
    private userAnalyzer;
    private contentFeatures;
    constructor(userAnalyzer: UserBehaviorAnalyzer);
    generateRecommendations(userId: string, type?: RecommendationType, limit?: number): Promise<Recommendation[]>;
    private generateContentRecommendations;
    private generateCollaborativeRecommendations;
    private generateSearchRecommendations;
    private generateTagRecommendations;
    private generateFeatureRecommendations;
    private findSimilarUsers;
    private cosineSimilarity;
    private generateRelatedQuery;
    private getRelatedTags;
    private getRecommendedFeatures;
}
export declare class PredictiveAnalyticsService {
    private userAnalyzer;
    private recommendationEngine;
    constructor();
    trackEvent(event: UserBehaviorEvent): void;
    getUserProfile(userId: string): UserProfile | null;
    getUserSegment(userId: string): string | null;
    getChurnRisk(userId: string): number;
    getRecommendations(userId: string, type?: RecommendationType, limit?: number): Promise<Recommendation[]>;
    getEngagementInsights(): AnalyticsInsight[];
    getUsersBySegment(segmentName: string): UserProfile[];
    getHighRiskUsers(threshold?: number): UserProfile[];
    getBusinessMetrics(): Record<string, any>;
    private getSegmentDistribution;
    private getTopCategories;
    private calculateRetentionRate;
}
export declare function createPredictiveAnalyticsService(): PredictiveAnalyticsService;
export default PredictiveAnalyticsService;
