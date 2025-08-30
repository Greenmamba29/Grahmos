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
import OpenAI from 'openai';
import { CohereClient } from 'cohere-ai';
import { PineconeClient } from '@pinecone-database/pinecone';
// OpenAI Embeddings Provider
export class OpenAIEmbeddingProvider {
    client;
    model;
    dimensions;
    constructor(apiKey, model = 'text-embedding-3-large') {
        this.client = new OpenAI({ apiKey });
        this.model = model;
        this.dimensions = this.getModelDimensions(model);
    }
    getModelDimensions(model) {
        const dimensionsMap = {
            'text-embedding-3-large': 3072,
            'text-embedding-3-small': 1536,
            'text-embedding-ada-002': 1536
        };
        return dimensionsMap[model] || 1536;
    }
    async generateEmbedding(text) {
        try {
            const response = await this.client.embeddings.create({
                model: this.model,
                input: text,
                encoding_format: 'float'
            });
            return response.data[0].embedding;
        }
        catch (error) {
            console.error('OpenAI embedding generation failed:', error);
            throw new Error(`Failed to generate OpenAI embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async generateBatchEmbeddings(texts) {
        try {
            const response = await this.client.embeddings.create({
                model: this.model,
                input: texts,
                encoding_format: 'float'
            });
            return response.data.map(item => item.embedding);
        }
        catch (error) {
            console.error('OpenAI batch embedding generation failed:', error);
            throw new Error(`Failed to generate OpenAI batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    getDimensions() {
        return this.dimensions;
    }
    getModel() {
        return this.model;
    }
}
// Cohere Embeddings Provider
export class CohereEmbeddingProvider {
    client;
    model;
    dimensions;
    constructor(apiKey, model = 'embed-multilingual-v3.0') {
        this.client = new CohereClient({ token: apiKey });
        this.model = model;
        this.dimensions = this.getModelDimensions(model);
    }
    getModelDimensions(model) {
        const dimensionsMap = {
            'embed-multilingual-v3.0': 1024,
            'embed-english-v3.0': 1024,
            'embed-multilingual-v2.0': 768,
            'embed-english-v2.0': 4096
        };
        return dimensionsMap[model] || 1024;
    }
    async generateEmbedding(text) {
        try {
            const response = await this.client.embed({
                texts: [text],
                model: this.model,
                inputType: 'search_document'
            });
            return response.embeddings[0];
        }
        catch (error) {
            console.error('Cohere embedding generation failed:', error);
            throw new Error(`Failed to generate Cohere embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async generateBatchEmbeddings(texts) {
        try {
            const response = await this.client.embed({
                texts,
                model: this.model,
                inputType: 'search_document'
            });
            return response.embeddings;
        }
        catch (error) {
            console.error('Cohere batch embedding generation failed:', error);
            throw new Error(`Failed to generate Cohere batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    getDimensions() {
        return this.dimensions;
    }
    getModel() {
        return this.model;
    }
}
// Pinecone Vector Database
export class PineconeVectorDatabase {
    client;
    indexName;
    namespace;
    constructor(apiKey, environment, indexName, namespace = 'grahmos') {
        this.client = new PineconeClient();
        this.client.init({
            apiKey,
            environment
        });
        this.indexName = indexName;
        this.namespace = namespace;
    }
    async createIndex(name, dimensions) {
        try {
            await this.client.createIndex({
                createRequest: {
                    name,
                    dimension: dimensions,
                    metric: 'cosine',
                    podType: 'p1.x1'
                }
            });
            // Wait for index to be ready
            let indexDescription;
            do {
                await new Promise(resolve => setTimeout(resolve, 1000));
                indexDescription = await this.client.describeIndex({ indexName: name });
            } while (indexDescription.status?.ready !== true);
            console.log(`Pinecone index ${name} created and ready`);
        }
        catch (error) {
            console.error('Failed to create Pinecone index:', error);
            throw error;
        }
    }
    async deleteIndex(name) {
        try {
            await this.client.deleteIndex({ indexName: name });
            console.log(`Pinecone index ${name} deleted`);
        }
        catch (error) {
            console.error('Failed to delete Pinecone index:', error);
            throw error;
        }
    }
    async upsertDocuments(documents) {
        try {
            const index = this.client.Index(this.indexName);
            const vectors = documents.map(doc => ({
                id: doc.id,
                values: doc.embedding,
                metadata: {
                    title: doc.title,
                    category: doc.metadata.category,
                    tags: doc.metadata.tags,
                    author: doc.metadata.author,
                    createdAt: doc.metadata.createdAt.toISOString(),
                    source: doc.metadata.source,
                    language: doc.metadata.language,
                    wordCount: doc.metadata.wordCount,
                    content: doc.content.substring(0, 1000) // Pinecone metadata has size limits
                }
            }));
            await index.upsert({
                upsertRequest: {
                    vectors,
                    namespace: this.namespace
                }
            });
            console.log(`Upserted ${documents.length} documents to Pinecone`);
        }
        catch (error) {
            console.error('Failed to upsert documents to Pinecone:', error);
            throw error;
        }
    }
    async deleteDocuments(documentIds) {
        try {
            const index = this.client.Index(this.indexName);
            await index.delete1({
                deleteRequest: {
                    ids: documentIds,
                    namespace: this.namespace
                }
            });
            console.log(`Deleted ${documentIds.length} documents from Pinecone`);
        }
        catch (error) {
            console.error('Failed to delete documents from Pinecone:', error);
            throw error;
        }
    }
    async searchSimilar(embedding, filters, limit = 10) {
        try {
            const index = this.client.Index(this.indexName);
            const filter = this.buildPineconeFilter(filters);
            const queryResponse = await index.query({
                queryRequest: {
                    vector: embedding,
                    topK: limit,
                    includeMetadata: true,
                    includeValues: false,
                    filter,
                    namespace: this.namespace
                }
            });
            return queryResponse.matches?.map(match => ({
                document: {
                    id: match.id,
                    title: match.metadata?.title || '',
                    content: match.metadata?.content || '',
                    metadata: {
                        category: match.metadata?.category || '',
                        tags: match.metadata?.tags || [],
                        author: match.metadata?.author,
                        createdAt: new Date(match.metadata?.createdAt),
                        updatedAt: new Date(match.metadata?.createdAt),
                        source: match.metadata?.source || '',
                        language: match.metadata?.language || 'en',
                        wordCount: match.metadata?.wordCount || 0
                    }
                },
                score: match.score || 0,
                relevanceScores: {
                    semantic: match.score || 0,
                    keyword: 0,
                    metadata: 0,
                    recency: 0
                }
            })) || [];
        }
        catch (error) {
            console.error('Failed to search Pinecone:', error);
            throw error;
        }
    }
    buildPineconeFilter(filters) {
        if (!filters)
            return undefined;
        const filter = {};
        if (filters.categories?.length) {
            filter.category = { $in: filters.categories };
        }
        if (filters.tags?.length) {
            filter.tags = { $in: filters.tags };
        }
        if (filters.authors?.length) {
            filter.author = { $in: filters.authors };
        }
        if (filters.language) {
            filter.language = { $eq: filters.language };
        }
        if (filters.dateRange) {
            filter.createdAt = {
                $gte: filters.dateRange.start.toISOString(),
                $lte: filters.dateRange.end.toISOString()
            };
        }
        return Object.keys(filter).length > 0 ? filter : undefined;
    }
    async getDocument(documentId) {
        try {
            const index = this.client.Index(this.indexName);
            const fetchResponse = await index.fetch({
                ids: [documentId],
                namespace: this.namespace
            });
            const vector = fetchResponse.vectors?.[documentId];
            if (!vector)
                return null;
            return {
                id: documentId,
                title: vector.metadata?.title || '',
                content: vector.metadata?.content || '',
                metadata: {
                    category: vector.metadata?.category || '',
                    tags: vector.metadata?.tags || [],
                    author: vector.metadata?.author,
                    createdAt: new Date(vector.metadata?.createdAt),
                    updatedAt: new Date(vector.metadata?.createdAt),
                    source: vector.metadata?.source || '',
                    language: vector.metadata?.language || 'en',
                    wordCount: vector.metadata?.wordCount || 0
                },
                embedding: vector.values
            };
        }
        catch (error) {
            console.error('Failed to fetch document from Pinecone:', error);
            return null;
        }
    }
}
// Document Chunking Strategies
export class DocumentChunker {
    static chunkByParagraph(document, maxTokens = 500) {
        const paragraphs = document.content.split(/\n\s*\n/);
        const chunks = [];
        let currentIndex = 0;
        paragraphs.forEach((paragraph, index) => {
            const trimmedParagraph = paragraph.trim();
            if (trimmedParagraph.length === 0)
                return;
            const approximateTokens = Math.ceil(trimmedParagraph.length / 4); // Rough estimate
            if (approximateTokens <= maxTokens) {
                chunks.push({
                    id: `${document.id}_chunk_${chunks.length}`,
                    documentId: document.id,
                    content: trimmedParagraph,
                    startIndex: currentIndex,
                    endIndex: currentIndex + trimmedParagraph.length,
                    embedding: [], // To be filled later
                    metadata: {
                        chunkIndex: chunks.length,
                        chunkType: 'paragraph',
                        tokens: approximateTokens
                    }
                });
            }
            else {
                // Split large paragraphs into smaller chunks
                const sentences = trimmedParagraph.split(/[.!?]+/);
                let currentChunk = '';
                let chunkStartIndex = currentIndex;
                sentences.forEach(sentence => {
                    const trimmedSentence = sentence.trim();
                    if (trimmedSentence.length === 0)
                        return;
                    const sentenceWithPunctuation = trimmedSentence + '.';
                    const chunkTokens = Math.ceil((currentChunk + sentenceWithPunctuation).length / 4);
                    if (chunkTokens <= maxTokens) {
                        currentChunk += (currentChunk ? ' ' : '') + sentenceWithPunctuation;
                    }
                    else {
                        if (currentChunk) {
                            chunks.push({
                                id: `${document.id}_chunk_${chunks.length}`,
                                documentId: document.id,
                                content: currentChunk,
                                startIndex: chunkStartIndex,
                                endIndex: chunkStartIndex + currentChunk.length,
                                embedding: [],
                                metadata: {
                                    chunkIndex: chunks.length,
                                    chunkType: 'paragraph',
                                    tokens: Math.ceil(currentChunk.length / 4)
                                }
                            });
                        }
                        currentChunk = sentenceWithPunctuation;
                        chunkStartIndex = currentIndex + trimmedParagraph.indexOf(trimmedSentence);
                    }
                });
                if (currentChunk) {
                    chunks.push({
                        id: `${document.id}_chunk_${chunks.length}`,
                        documentId: document.id,
                        content: currentChunk,
                        startIndex: chunkStartIndex,
                        endIndex: chunkStartIndex + currentChunk.length,
                        embedding: [],
                        metadata: {
                            chunkIndex: chunks.length,
                            chunkType: 'paragraph',
                            tokens: Math.ceil(currentChunk.length / 4)
                        }
                    });
                }
            }
            currentIndex += paragraph.length + 2; // +2 for the double newline
        });
        return chunks;
    }
    static chunkByFixedSize(document, chunkSize = 1000, overlap = 200) {
        const chunks = [];
        const content = document.content;
        let startIndex = 0;
        while (startIndex < content.length) {
            const endIndex = Math.min(startIndex + chunkSize, content.length);
            let chunkContent = content.substring(startIndex, endIndex);
            // Try to break at sentence boundary
            if (endIndex < content.length) {
                const lastSentenceEnd = chunkContent.lastIndexOf('.');
                if (lastSentenceEnd > chunkSize * 0.5) {
                    chunkContent = chunkContent.substring(0, lastSentenceEnd + 1);
                }
            }
            chunks.push({
                id: `${document.id}_chunk_${chunks.length}`,
                documentId: document.id,
                content: chunkContent.trim(),
                startIndex,
                endIndex: startIndex + chunkContent.length,
                embedding: [],
                metadata: {
                    chunkIndex: chunks.length,
                    chunkType: 'section',
                    tokens: Math.ceil(chunkContent.length / 4)
                }
            });
            startIndex += chunkContent.length - overlap;
        }
        return chunks;
    }
}
// Main Vector Search Service
export class VectorSearchService {
    embeddingProvider;
    vectorDatabase;
    indexName;
    constructor(embeddingProvider, vectorDatabase, indexName = 'grahmos-documents') {
        this.embeddingProvider = embeddingProvider;
        this.vectorDatabase = vectorDatabase;
        this.indexName = indexName;
    }
    async initialize() {
        try {
            await this.vectorDatabase.createIndex(this.indexName, this.embeddingProvider.getDimensions());
            console.log('Vector search service initialized');
        }
        catch (error) {
            console.error('Failed to initialize vector search service:', error);
            throw error;
        }
    }
    async indexDocument(document, chunkingStrategy = 'paragraph') {
        try {
            // Generate chunks
            const chunks = chunkingStrategy === 'paragraph'
                ? DocumentChunker.chunkByParagraph(document)
                : DocumentChunker.chunkByFixedSize(document);
            // Generate embeddings for chunks
            const chunkTexts = chunks.map(chunk => chunk.content);
            const embeddings = await this.embeddingProvider.generateBatchEmbeddings(chunkTexts);
            // Assign embeddings to chunks
            chunks.forEach((chunk, index) => {
                chunk.embedding = embeddings[index];
            });
            // Also generate embedding for the full document
            document.embedding = await this.embeddingProvider.generateEmbedding(`${document.title}\n\n${document.content.substring(0, 8000)}` // Use title + first 8k chars
            );
            document.chunks = chunks;
            // Store in vector database
            await this.vectorDatabase.upsertDocuments([document]);
            console.log(`Indexed document ${document.id} with ${chunks.length} chunks`);
        }
        catch (error) {
            console.error(`Failed to index document ${document.id}:`, error);
            throw error;
        }
    }
    async indexDocuments(documents, chunkingStrategy = 'paragraph') {
        const batchSize = 10; // Process documents in batches
        for (let i = 0; i < documents.length; i += batchSize) {
            const batch = documents.slice(i, i + batchSize);
            await Promise.all(batch.map(doc => this.indexDocument(doc, chunkingStrategy)));
            console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)}`);
        }
    }
    async search(searchQuery) {
        const startTime = Date.now();
        try {
            // Generate query embedding
            const queryEmbedding = await this.embeddingProvider.generateEmbedding(searchQuery.query);
            // Perform vector search
            const vectorResults = await this.vectorDatabase.searchSimilar(queryEmbedding, searchQuery.filters, searchQuery.options?.limit || 20);
            // Apply reranking if requested
            let results = vectorResults;
            if (searchQuery.options?.rerankResults) {
                results = await this.rerankResults(searchQuery.query, vectorResults);
            }
            // Apply diversity boost if requested
            if (searchQuery.options?.diversityBoost) {
                results = this.applyDiversityBoost(results, searchQuery.options.diversityBoost);
            }
            // Generate search suggestions
            const suggestions = await this.generateSearchSuggestions(searchQuery.query, results);
            const searchTime = Date.now() - startTime;
            return {
                results: results.slice(0, searchQuery.options?.limit || 10),
                query: searchQuery.query,
                totalResults: results.length,
                searchTime,
                searchMode: searchQuery.options?.searchMode || 'semantic',
                suggestions
            };
        }
        catch (error) {
            console.error('Vector search failed:', error);
            throw error;
        }
    }
    async rerankResults(query, results) {
        // Simple reranking based on query-result content similarity
        // In production, you might use a dedicated reranking model
        const queryWords = query.toLowerCase().split(/\s+/);
        return results.map(result => {
            const content = result.document.content.toLowerCase();
            const title = result.document.title.toLowerCase();
            // Calculate keyword relevance
            const keywordScore = queryWords.reduce((score, word) => {
                const titleMatches = (title.match(new RegExp(word, 'g')) || []).length;
                const contentMatches = (content.match(new RegExp(word, 'g')) || []).length;
                return score + (titleMatches * 2) + contentMatches;
            }, 0) / queryWords.length;
            // Calculate recency score (more recent = higher score)
            const daysSinceCreation = (Date.now() - result.document.metadata.createdAt.getTime()) / (1000 * 60 * 60 * 24);
            const recencyScore = Math.max(0, 1 - daysSinceCreation / 365); // Decay over a year
            // Update relevance scores
            result.relevanceScores.keyword = keywordScore * 0.1;
            result.relevanceScores.recency = recencyScore * 0.1;
            // Combine scores with weights
            const combinedScore = result.relevanceScores.semantic * 0.7 +
                result.relevanceScores.keyword * 0.2 +
                result.relevanceScores.recency * 0.1;
            result.score = combinedScore;
            return result;
        }).sort((a, b) => b.score - a.score);
    }
    applyDiversityBoost(results, diversityBoost) {
        // Simple diversity algorithm - reduce score for documents with similar categories/tags
        const seenCategories = new Set();
        const seenTags = new Set();
        return results.map(result => {
            let diversityPenalty = 0;
            // Penalize repeated categories
            if (seenCategories.has(result.document.metadata.category)) {
                diversityPenalty += diversityBoost * 0.5;
            }
            else {
                seenCategories.add(result.document.metadata.category);
            }
            // Penalize repeated tags
            for (const tag of result.document.metadata.tags) {
                if (seenTags.has(tag)) {
                    diversityPenalty += diversityBoost * 0.1;
                }
                else {
                    seenTags.add(tag);
                }
            }
            result.score = Math.max(0, result.score - diversityPenalty);
            return result;
        }).sort((a, b) => b.score - a.score);
    }
    async generateSearchSuggestions(query, results) {
        // Extract common terms from top results
        const topResults = results.slice(0, 5);
        const allText = topResults.map(r => r.document.title + ' ' + r.document.content).join(' ');
        // Simple term frequency analysis
        const words = allText.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3);
        const wordFreq = {};
        words.forEach(word => {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        });
        // Get most frequent terms not in original query
        const queryWords = new Set(query.toLowerCase().split(/\s+/));
        const suggestions = Object.entries(wordFreq)
            .filter(([word, freq]) => !queryWords.has(word) && freq >= 2)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([word]) => word);
        return suggestions;
    }
    async deleteDocument(documentId) {
        try {
            await this.vectorDatabase.deleteDocuments([documentId]);
            console.log(`Deleted document ${documentId} from vector index`);
        }
        catch (error) {
            console.error(`Failed to delete document ${documentId}:`, error);
            throw error;
        }
    }
    async getDocument(documentId) {
        try {
            return await this.vectorDatabase.getDocument(documentId);
        }
        catch (error) {
            console.error(`Failed to get document ${documentId}:`, error);
            return null;
        }
    }
    async getSimilarDocuments(documentId, limit = 5) {
        try {
            const document = await this.getDocument(documentId);
            if (!document || !document.embedding) {
                throw new Error('Document not found or has no embedding');
            }
            const results = await this.vectorDatabase.searchSimilar(document.embedding, undefined, limit + 1);
            // Remove the original document from results
            return results.filter(result => result.document.id !== documentId).slice(0, limit);
        }
        catch (error) {
            console.error(`Failed to get similar documents for ${documentId}:`, error);
            throw error;
        }
    }
}
// Factory function to create configured service
export function createVectorSearchService(config) {
    // Create embedding provider
    let embeddingProvider;
    switch (config.embeddingProvider) {
        case 'openai':
            embeddingProvider = new OpenAIEmbeddingProvider(config.embeddingApiKey, config.embeddingModel);
            break;
        case 'cohere':
            embeddingProvider = new CohereEmbeddingProvider(config.embeddingApiKey, config.embeddingModel);
            break;
        default:
            throw new Error(`Unsupported embedding provider: ${config.embeddingProvider}`);
    }
    // Create vector database
    let vectorDatabase;
    switch (config.vectorDatabase) {
        case 'pinecone':
            vectorDatabase = new PineconeVectorDatabase(config.vectorApiKey, config.vectorEnvironment || 'us-west1-gcp', config.indexName || 'grahmos-documents');
            break;
        default:
            throw new Error(`Unsupported vector database: ${config.vectorDatabase}`);
    }
    return new VectorSearchService(embeddingProvider, vectorDatabase, config.indexName);
}
export default VectorSearchService;
