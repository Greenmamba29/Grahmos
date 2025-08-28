import { SearchBackend, SearchResult, SearchOptions, Document, BackendStatus } from './types.js';
export declare class MeilisearchBackend implements SearchBackend {
    readonly name = "meilisearch";
    private baseUrl;
    private apiKey;
    private indexName;
    constructor();
    initialize(): Promise<void>;
    search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
    getDocument(id: string): Promise<Document | null>;
    getStatus(): Promise<BackendStatus>;
    private request;
    private extractSnippet;
    private calculateScore;
}
//# sourceMappingURL=meilisearch.d.ts.map