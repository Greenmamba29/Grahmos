/**
 * Natural Language Query Processing System
 *
 * This module provides conversational search capabilities including:
 * - Intent recognition and classification
 * - Entity extraction and query understanding
 * - Natural language to structured query conversion
 * - Contextual conversation management
 * - Intelligent response generation
 */
import { z } from 'zod';
export interface QueryIntent {
    intent: string;
    confidence: number;
    entities: ExtractedEntity[];
    parameters: Record<string, any>;
}
export interface ExtractedEntity {
    type: string;
    value: string;
    confidence: number;
    start: number;
    end: number;
}
export interface ConversationContext {
    sessionId: string;
    userId?: string;
    messages: ConversationMessage[];
    currentIntent?: QueryIntent;
    previousIntents: QueryIntent[];
    metadata: Record<string, any>;
    timestamp: number;
}
export interface ConversationMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    intent?: QueryIntent;
    metadata?: Record<string, any>;
}
export interface StructuredQuery {
    type: 'search' | 'filter' | 'aggregate' | 'command' | 'question';
    operation: string;
    parameters: Record<string, any>;
    filters: QueryFilter[];
    sorting?: QuerySort;
    pagination?: QueryPagination;
    confidence: number;
}
export interface QueryFilter {
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'regex';
    value: any;
}
export interface QuerySort {
    field: string;
    order: 'asc' | 'desc';
}
export interface QueryPagination {
    limit: number;
    offset: number;
}
export interface QueryResponse {
    id: string;
    query: string;
    intent: QueryIntent;
    structuredQuery: StructuredQuery;
    results: QueryResult[];
    response: string;
    suggestions: string[];
    confidence: number;
    processingTime: number;
    metadata: Record<string, any>;
}
export interface QueryResult {
    id: string;
    type: string;
    title: string;
    content: string;
    relevanceScore: number;
    metadata: Record<string, any>;
}
export declare const NLPQueryConfigSchema: any;
export type NLPQueryConfig = z.infer<typeof NLPQueryConfigSchema>;
/**
 * Intent Classification System
 */
export declare class IntentClassifier {
    private tokenizer;
    private stemmer;
    private tfidf;
    private intentPatterns;
    constructor();
    private initializeIntentPatterns;
    classifyIntent(query: string): QueryIntent;
    private extractEntities;
    private extractParameters;
    private extractKeywords;
    private extractFilterConditions;
    private extractCountType;
}
/**
 * Query Structure Generator
 */
export declare class QueryStructureGenerator {
    private config;
    constructor(config: NLPQueryConfig);
    generateStructuredQuery(intent: QueryIntent, query: string): StructuredQuery;
    private generateSearchQuery;
    private generateFilterQuery;
    private generateAggregateQuery;
    private generateCompareQuery;
    private generateGenericQuery;
    private parseDateEntity;
}
/**
 * Response Generator
 */
export declare class ResponseGenerator {
    private config;
    private openai;
    constructor(config: NLPQueryConfig);
    generateResponse(query: string, intent: QueryIntent, structuredQuery: StructuredQuery, results: QueryResult[], context?: ConversationContext): Promise<string>;
    private buildSystemPrompt;
    private buildUserPrompt;
    private generateFallbackResponse;
    generateSuggestions(query: string, intent: QueryIntent, results: QueryResult[]): string[];
}
/**
 * Main Natural Language Query Processing System
 */
export declare class NLPQueryProcessor {
    private config;
    private intentClassifier;
    private queryGenerator;
    private responseGenerator;
    private conversations;
    constructor(config: Partial<NLPQueryConfig>);
    processQuery(query: string, sessionId: string, userId?: string, searchFunction?: (structuredQuery: StructuredQuery) => Promise<QueryResult[]>): Promise<QueryResponse>;
    private getOrCreateContext;
    private updateConversationContext;
    private generateMockResults;
    getConversationHistory(sessionId: string): ConversationMessage[];
    clearConversation(sessionId: string): void;
    getActiveConversations(): number;
}
export default NLPQueryProcessor;
