import type { AISearchResult } from 'ai-search';
export interface SemanticSearchQuery {
    id: string;
    query: string;
    reasoning_effort: 'low' | 'medium' | 'high';
    context?: SemanticContext;
    streaming?: boolean;
    include_cot?: boolean;
    max_results?: number;
    timestamp: number;
}
export interface SemanticContext {
    previous_queries: string[];
    document_context: string[];
    user_preferences: Record<string, any>;
    emergency_context?: {
        situation: string;
        urgency: 'low' | 'medium' | 'high' | 'critical';
        location?: string;
    };
}
export interface SemanticSearchResult extends AISearchResult {
    semantic_score: number;
    reasoning_trace?: string;
    context_relevance: number;
    citations: SemanticCitation[];
    processing_time: number;
    model_used: 'gpt-oss-20b' | 'gpt-oss-120b';
    real_time_updates?: boolean;
}
export interface SemanticCitation {
    document_id: string;
    relevance_score: number;
    excerpt: string;
    reasoning: string;
}
export interface SemanticSearchResponse {
    query_id: string;
    results: SemanticSearchResult[];
    semantic_summary: string;
    reasoning_chain: ReasoningStep[];
    suggested_queries: string[];
    context_insights: string[];
    streaming_complete: boolean;
    total_processing_time: number;
    cache_hit: boolean;
}
export interface ReasoningStep {
    step: number;
    description: string;
    confidence: number;
    sources: string[];
}
export interface SemanticSearchConfig {
    model_path?: string;
    model_size: 'gpt-oss-20b' | 'gpt-oss-120b';
    max_context_length: number;
    enable_streaming: boolean;
    enable_p2p_broadcast: boolean;
    reasoning_effort_default: 'low' | 'medium' | 'high';
    cache_ttl: number;
    max_concurrent_queries: number;
    gpu_memory_utilization: number;
    enable_real_time_updates: boolean;
}
export interface P2PSemanticMessage {
    type: 'semantic_query' | 'semantic_response' | 'semantic_update';
    payload: SemanticSearchQuery | SemanticSearchResponse | SemanticUpdate;
    node_id: string;
    timestamp: number;
    signature?: string;
}
export interface SemanticUpdate {
    query_id: string;
    update_type: 'new_result' | 'improved_ranking' | 'context_change';
    data: Partial<SemanticSearchResult> | SemanticSearchResult[];
}
export interface SemanticSearchEngine {
    initialize(): Promise<void>;
    search(query: SemanticSearchQuery): Promise<SemanticSearchResponse>;
    searchStreaming(query: SemanticSearchQuery): AsyncGenerator<SemanticSearchResult, void, unknown>;
    updateContext(context: SemanticContext): Promise<void>;
    getConfig(): SemanticSearchConfig;
    updateConfig(config: Partial<SemanticSearchConfig>): Promise<void>;
    dispose(): Promise<void>;
}
export interface SemanticSearchCache {
    get(query_hash: string): Promise<SemanticSearchResponse | null>;
    set(query_hash: string, response: SemanticSearchResponse): Promise<void>;
    invalidate(pattern?: string): Promise<void>;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=types.d.ts.map