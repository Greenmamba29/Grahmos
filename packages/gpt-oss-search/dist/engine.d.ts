import { EventEmitter } from 'node:events';
import type { SemanticSearchEngine, SemanticSearchQuery, SemanticSearchResponse, SemanticSearchResult, SemanticSearchConfig, SemanticContext, SemanticSearchCache } from './types';
export declare class GPTOSSSemanticEngine extends EventEmitter implements SemanticSearchEngine {
    private config;
    private gptOssProcess;
    private isInitialized;
    private queryQueue;
    private cache;
    private context;
    constructor(config?: Partial<SemanticSearchConfig>, cache?: SemanticSearchCache);
    initialize(): Promise<void>;
    private initializeGPTOSSConnection;
    search(query: SemanticSearchQuery): Promise<SemanticSearchResponse>;
    searchStreaming(query: SemanticSearchQuery): AsyncGenerator<SemanticSearchResult, void, unknown>;
    private performSemanticSearch;
    private calculateSemanticScore;
    private generateSemanticCitations;
    private generateReasoningTrace;
    private generateSemanticSummary;
    private generateContextualSuggestions;
    private generateContextInsights;
    private enhanceResultWithSemantic;
    private calculateContextRelevance;
    private performDeepSemanticAnalysis;
    private fallbackToAISearch;
    updateContext(context: SemanticContext): Promise<void>;
    getConfig(): SemanticSearchConfig;
    updateConfig(config: Partial<SemanticSearchConfig>): Promise<void>;
    dispose(): Promise<void>;
    private generateQueryHash;
}
//# sourceMappingURL=engine.d.ts.map