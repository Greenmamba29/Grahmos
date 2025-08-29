/**
 * Grahmos Vector Search and Semantic Embeddings Service
 * Phase 12: Advanced AI/ML Integration
 *
 * Features:
 * - Vector database integration (Pinecone, Weaviate, Qdrant)
 * - OpenAI and Cohere embeddings support
 * - Semantic search and similarity matching
 * - Hybrid search (keyword + semantic)
 * - Document chunking and embedding strategies
 * - Search result ranking and filtering
 */
export interface Document {
    id: string;
    title: string;
    content: string;
    metadata: {
        author?: string;
        createdAt: Date;
        updatedAt: Date;
        tags: string[];
        category: string;
        source: string;
        language: string;
        wordCount: number;
        [key: string]: any;
    };
    embedding?: number[];
    chunks?: DocumentChunk[];
}
export interface DocumentChunk {
    id: string;
    documentId: string;
    content: string;
    startIndex: number;
    endIndex: number;
    embedding: number[];
    metadata: {
        chunkIndex: number;
        chunkType: 'paragraph' | 'section' | 'heading' | 'table' | 'list';
        tokens: number;
    };
}
export interface SearchQuery {
    query: string;
    filters?: SearchFilters;
    options?: SearchOptions;
}
export interface SearchFilters {
    categories?: string[];
    tags?: string[];
    authors?: string[];
    dateRange?: {
        start: Date;
        end: Date;
    };
    language?: string;
    source?: string[];
    metadata?: Record<string, any>;
}
export interface SearchOptions {
    limit?: number;
    offset?: number;
    threshold?: number;
    includeContent?: boolean;
    includeMetadata?: boolean;
    searchMode?: 'semantic' | 'keyword' | 'hybrid';
    rerankResults?: boolean;
    diversityBoost?: number;
}
export interface SearchResult {
    document: Document;
    chunk?: DocumentChunk;
    score: number;
    relevanceScores: {
        semantic: number;
        keyword: number;
        metadata: number;
        recency: number;
    };
    explanation?: string;
    highlights?: string[];
}
export interface SearchResponse {
    results: SearchResult[];
    query: string;
    totalResults: number;
    searchTime: number;
    searchMode: string;
    suggestions?: string[];
    facets?: Record<string, FacetResult[]>;
}
export interface FacetResult {
    value: string;
    count: number;
}
export interface EmbeddingProvider {
    generateEmbedding(text: string): Promise<number[]>;
    generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
    getDimensions(): number;
    getModel(): string;
}
export interface VectorDatabase {
    upsertDocuments(documents: Document[]): Promise<void>;
    deleteDocuments(documentIds: string[]): Promise<void>;
    searchSimilar(embedding: number[], filters?: SearchFilters, limit?: number): Promise<SearchResult[]>;
    getDocument(documentId: string): Promise<Document | null>;
    createIndex(name: string, dimensions: number): Promise<void>;
    deleteIndex(name: string): Promise<void>;
}
export declare class OpenAIEmbeddingProvider implements EmbeddingProvider {
    private client;
    private model;
    private dimensions;
    constructor(apiKey: string, model?: string);
    private getModelDimensions;
    generateEmbedding(text: string): Promise<number[]>;
    generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
    getDimensions(): number;
    getModel(): string;
}
export declare class CohereEmbeddingProvider implements EmbeddingProvider {
    private client;
    private model;
    private dimensions;
    constructor(apiKey: string, model?: string);
    private getModelDimensions;
    generateEmbedding(text: string): Promise<number[]>;
    generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
    getDimensions(): number;
    getModel(): string;
}
export declare class PineconeVectorDatabase implements VectorDatabase {
    private client;
    private indexName;
    private namespace;
    constructor(apiKey: string, environment: string, indexName: string, namespace?: string);
    createIndex(name: string, dimensions: number): Promise<void>;
    deleteIndex(name: string): Promise<void>;
    upsertDocuments(documents: Document[]): Promise<void>;
    deleteDocuments(documentIds: string[]): Promise<void>;
    searchSimilar(embedding: number[], filters?: SearchFilters, limit?: number): Promise<SearchResult[]>;
    private buildPineconeFilter;
    getDocument(documentId: string): Promise<Document | null>;
}
export declare class DocumentChunker {
    static chunkByParagraph(document: Document, maxTokens?: number): DocumentChunk[];
    static chunkByFixedSize(document: Document, chunkSize?: number, overlap?: number): DocumentChunk[];
}
export declare class VectorSearchService {
    private embeddingProvider;
    private vectorDatabase;
    private indexName;
    constructor(embeddingProvider: EmbeddingProvider, vectorDatabase: VectorDatabase, indexName?: string);
    initialize(): Promise<void>;
    indexDocument(document: Document, chunkingStrategy?: 'paragraph' | 'fixed_size'): Promise<void>;
    indexDocuments(documents: Document[], chunkingStrategy?: 'paragraph' | 'fixed_size'): Promise<void>;
    search(searchQuery: SearchQuery): Promise<SearchResponse>;
    private rerankResults;
    private applyDiversityBoost;
    private generateSearchSuggestions;
    deleteDocument(documentId: string): Promise<void>;
    getDocument(documentId: string): Promise<Document | null>;
    getSimilarDocuments(documentId: string, limit?: number): Promise<SearchResult[]>;
}
export declare function createVectorSearchService(config: {
    embeddingProvider: 'openai' | 'cohere';
    embeddingApiKey: string;
    embeddingModel?: string;
    vectorDatabase: 'pinecone';
    vectorApiKey: string;
    vectorEnvironment?: string;
    indexName?: string;
}): VectorSearchService;
export default VectorSearchService;
