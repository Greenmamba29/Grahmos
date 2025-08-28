export interface SearchResult {
    id: string;
    title: string;
    snippet?: string;
    content?: string;
    score?: number;
    metadata?: Record<string, any>;
}
export interface SearchOptions {
    limit?: number;
    offset?: number;
    filters?: Record<string, any>;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface Document {
    id: string;
    title: string;
    content: string;
    metadata?: Record<string, any>;
}
export interface BackendStatus {
    healthy: boolean;
    version?: string;
    indexSize?: number;
    lastUpdated?: string;
    error?: string;
}
export interface SearchBackend {
    readonly name: string;
    initialize(): Promise<void>;
    search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
    getDocument(id: string): Promise<Document | null>;
    getStatus(): Promise<BackendStatus>;
    cleanup?(): Promise<void>;
}
//# sourceMappingURL=types.d.ts.map