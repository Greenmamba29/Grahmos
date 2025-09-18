export * from './client';
export * from './types';
export { initializeGPTOSS as initSemanticSearch, semanticSearch, analyzeSearchIntent, createBrowserSemanticEngine } from './client';
declare const _default: {
    initialize: (config?: Partial<import("./types").SemanticSearchConfig>) => import("./client").BrowserGPTOSSSemanticEngine;
    search: (query: string, options?: {
        max_results?: number;
        context?: import("./types").SemanticContext;
        reasoning_effort?: "low" | "medium" | "high";
        emergency_mode?: boolean;
    }) => Promise<import("./types").SemanticSearchResponse>;
    analyze: (query: string, emergencyMode?: boolean) => Promise<string>;
};
export default _default;
//# sourceMappingURL=index.d.ts.map