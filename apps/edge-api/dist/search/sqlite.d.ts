import { SearchBackend, SearchResult, SearchOptions, Document, BackendStatus } from './types.js';
export declare class SqliteSearchBackend implements SearchBackend {
    readonly name = "sqlite";
    private db;
    private dbPath;
    constructor();
    initialize(): Promise<void>;
    search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
    getDocument(id: string): Promise<Document | null>;
    getStatus(): Promise<BackendStatus>;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=sqlite.d.ts.map