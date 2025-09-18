/**
 * Browser-compatible GPT-OSS Semantic Search Client
 * This version avoids Node.js-specific modules and provides fallback behavior
 */
import type { SemanticSearchEngine, SemanticSearchQuery, SemanticSearchResponse, SemanticSearchResult, SemanticSearchConfig, SemanticContext, SemanticSearchCache } from './types';
declare class SimpleEventEmitter {
    private events;
    on(event: string, callback: Function): void;
    emit(event: string, ...args: any[]): void;
}
export declare class BrowserGPTOSSSemanticEngine extends SimpleEventEmitter implements SemanticSearchEngine {
    private config;
    private isInitialized;
    private cache;
    private context;
    constructor(config?: Partial<SemanticSearchConfig>, cache?: SemanticSearchCache);
    initialize(): Promise<void>;
    private initializeBrowserSemanticSearch;
    search(query: SemanticSearchQuery): Promise<SemanticSearchResponse>;
    searchStreaming(query: SemanticSearchQuery): AsyncGenerator<SemanticSearchResult, void, unknown>;
    private generateBrowserQueryHash;
    private performBrowserSemanticSearch;
    private enhanceResultWithBrowserSemantic;
    private performBrowserDeepAnalysis;
    private generateSuggestedQueries;
    private fallbackToBrowserSearch;
    private browserDelay;
    updateContext(context: SemanticContext): Promise<void>;
    getContext(): Promise<SemanticContext>;
    clearCache(): Promise<void>;
    dispose(): Promise<void>;
    getConfig(): SemanticSearchConfig;
    updateConfig(newConfig: Partial<SemanticSearchConfig>): Promise<void>;
}
export declare const createBrowserSemanticEngine: (config?: Partial<SemanticSearchConfig>) => BrowserGPTOSSSemanticEngine;
export declare const initializeGPTOSS: (config?: Partial<SemanticSearchConfig>) => BrowserGPTOSSSemanticEngine;
export declare const semanticSearch: (query: string, options?: {
    max_results?: number;
    context?: SemanticContext;
    reasoning_effort?: "low" | "medium" | "high";
    emergency_mode?: boolean;
}) => Promise<SemanticSearchResponse>;
export declare const analyzeSearchIntent: (query: string, emergencyMode?: boolean) => Promise<string>;
export {};
//# sourceMappingURL=client.d.ts.map