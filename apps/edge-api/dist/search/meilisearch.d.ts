import { SearchBackend, SearchResult, SearchOptions, Document, BackendStatus } from './types.js';
export declare class MeilisearchBackend implements SearchBackend {
    readonly name = "meilisearch";
    private baseUrl;
    private apiKey;
    private indexName;
    constructor();
    initialize(): Promise<void>;
    search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
    index(documents: Document[]): Promise<void>;
    delete(id: string): Promise<void>;
    getStatus(): Promise<BackendStatus>;
    private request;
    private extractSnippet;
    clear(): Promise<void>;
    getDocument(id: string): Promise<Document | null>;
}
//# sourceMappingURL=meilisearch.d.ts.map