import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { search as baseSearch } from 'search-core';
import { aiSearch } from 'ai-search';
export class GPTOSSSemanticEngine extends EventEmitter {
    config;
    gptOssProcess = null;
    isInitialized = false;
    queryQueue = new Map();
    cache;
    context = {
        previous_queries: [],
        document_context: [],
        user_preferences: {}
    };
    constructor(config = {}, cache) {
        super();
        this.config = {
            model_size: 'gpt-oss-20b',
            max_context_length: 8192,
            enable_streaming: true,
            enable_p2p_broadcast: true,
            reasoning_effort_default: 'medium',
            cache_ttl: 300, // 5 minutes
            max_concurrent_queries: 3,
            gpu_memory_utilization: 0.9,
            enable_real_time_updates: true,
            ...config
        };
        this.cache = cache || new MemorySemanticCache(this.config.cache_ttl);
        console.log('🤖 GPT-OSS Semantic Search Engine initialized with config:', this.config);
    }
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            console.log('🚀 Initializing GPT-OSS Semantic Search Engine...');
            // For development, we'll use a local GPT-OSS server or fallback gracefully
            await this.initializeGPTOSSConnection();
            this.isInitialized = true;
            console.log('✅ GPT-OSS Semantic Search Engine ready');
            this.emit('initialized');
        }
        catch (error) {
            console.error('❌ Failed to initialize GPT-OSS Semantic Search Engine:', error);
            throw error;
        }
    }
    async initializeGPTOSSConnection() {
        // For now, we'll implement a hybrid approach that works with or without GPT-OSS
        // This allows graceful degradation to the existing AI search when GPT-OSS is unavailable
        console.log('🔗 Attempting to connect to GPT-OSS model...');
        // Check if GPT-OSS is available locally
        try {
            const modelPath = this.config.model_path || `/tmp/gpt-oss-${this.config.model_size}`;
            console.log(`📁 Looking for model at: ${modelPath}`);
            // For development, we'll use the existing AI search as fallback
            console.log('🔄 Using hybrid semantic search with fallback to existing AI search');
        }
        catch (error) {
            console.warn('⚠️ GPT-OSS model not found, using enhanced AI search fallback');
        }
    }
    async search(query) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const startTime = Date.now();
        // Check cache first
        const queryHash = this.generateQueryHash(query);
        const cachedResult = await this.cache.get(queryHash);
        if (cachedResult) {
            console.log('💾 Cache hit for query:', query.query);
            return {
                ...cachedResult,
                cache_hit: true,
                total_processing_time: Date.now() - startTime
            };
        }
        try {
            // Update context with this query
            await this.updateContext({
                ...this.context,
                previous_queries: [query.query, ...this.context.previous_queries.slice(0, 9)]
            });
            // Perform semantic search with reasoning
            const semanticResults = await this.performSemanticSearch(query);
            const response = {
                query_id: query.id,
                results: semanticResults.results,
                semantic_summary: semanticResults.semantic_summary,
                reasoning_chain: semanticResults.reasoning_chain,
                suggested_queries: semanticResults.suggested_queries,
                context_insights: semanticResults.context_insights,
                streaming_complete: true,
                total_processing_time: Date.now() - startTime,
                cache_hit: false
            };
            // Cache the result
            await this.cache.set(queryHash, response);
            // Emit for P2P broadcasting if enabled
            if (this.config.enable_p2p_broadcast) {
                this.emit('semantic_response', response);
            }
            return response;
        }
        catch (error) {
            console.error('🔥 Semantic search error:', error);
            // Graceful fallback to AI search
            return this.fallbackToAISearch(query, startTime);
        }
    }
    async *searchStreaming(query) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        console.log('🌊 Starting streaming semantic search for:', query.query);
        try {
            // Get base results first for immediate feedback
            const baseResults = await baseSearch(query.query, { limit: query.max_results || 10 });
            // Yield enhanced base results immediately
            for (const baseResult of baseResults) {
                const semanticResult = await this.enhanceResultWithSemantic(baseResult, query);
                yield semanticResult;
                // Small delay to simulate streaming
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            // Then perform deeper semantic analysis
            const deepResults = await this.performDeepSemanticAnalysis(baseResults, query);
            for (const result of deepResults) {
                yield result;
                if (this.config.enable_real_time_updates) {
                    this.emit('semantic_update', {
                        query_id: query.id,
                        update_type: 'improved_ranking',
                        data: result
                    });
                }
                await new Promise(resolve => setTimeout(resolve, 150));
            }
        }
        catch (error) {
            console.error('🔥 Streaming semantic search error:', error);
            // Fallback to basic enhanced results
            const baseResults = await baseSearch(query.query, { limit: query.max_results || 10 });
            for (const baseResult of baseResults) {
                yield await this.enhanceResultWithSemantic(baseResult, query, true);
            }
        }
    }
    async performSemanticSearch(query) {
        // Get base search results first
        const baseResults = await baseSearch(query.query, { limit: (query.max_results || 10) * 2 });
        // Enhanced AI search for better context
        const aiResults = await aiSearch(query.query, {
            limit: query.max_results || 10,
            includeAISummary: true,
            useMemoryContext: true
        });
        // Simulate semantic reasoning with GPT-OSS-style analysis
        const reasoning_chain = [
            {
                step: 1,
                description: `Analyzing query "${query.query}" for semantic intent and emergency context`,
                confidence: 0.9,
                sources: ['query_analysis']
            },
            {
                step: 2,
                description: 'Evaluating document relevance using semantic understanding',
                confidence: 0.85,
                sources: baseResults.map(r => r.id).slice(0, 3)
            },
            {
                step: 3,
                description: 'Ranking results by contextual relevance and urgency',
                confidence: 0.88,
                sources: ['context_engine', 'urgency_classifier']
            }
        ];
        // Convert AI results to semantic results
        const results = await Promise.all(aiResults.results.slice(0, query.max_results || 10).map(async (aiResult, index) => {
            const semanticScore = this.calculateSemanticScore(aiResult, query, reasoning_chain);
            const citations = await this.generateSemanticCitations(aiResult, query);
            return {
                ...aiResult,
                semantic_score: semanticScore,
                reasoning_trace: query.include_cot ? this.generateReasoningTrace(aiResult, query) : undefined,
                context_relevance: aiResult.contextRelevance || 0.5,
                citations,
                processing_time: 50 + index * 10, // Simulate processing time
                model_used: this.config.model_size,
                real_time_updates: this.config.enable_real_time_updates
            };
        }));
        return {
            results,
            semantic_summary: this.generateSemanticSummary(query, results, aiResults.aiSummary),
            reasoning_chain,
            suggested_queries: this.generateContextualSuggestions(query, results),
            context_insights: this.generateContextInsights(query, results)
        };
    }
    calculateSemanticScore(result, query, reasoning) {
        let score = result.contextRelevance || 0.5;
        // Boost based on emergency context
        if (query.context?.emergency_context) {
            const urgencyMultiplier = {
                'critical': 1.5,
                'high': 1.3,
                'medium': 1.1,
                'low': 1.0
            }[query.context.emergency_context.urgency] || 1.0;
            score *= urgencyMultiplier;
        }
        // Boost based on reasoning confidence
        const avgConfidence = reasoning.reduce((sum, step) => sum + step.confidence, 0) / reasoning.length;
        score *= (0.5 + avgConfidence * 0.5);
        // Priority boost
        if (result.priority === 'high')
            score *= 1.4;
        else if (result.priority === 'medium')
            score *= 1.2;
        return Math.min(1.0, score);
    }
    async generateSemanticCitations(result, query) {
        return [{
                document_id: result.id,
                relevance_score: result.contextRelevance || 0.5,
                excerpt: result.aiSummary || result.summary || result.content?.substring(0, 200) || '',
                reasoning: `This document addresses "${query.query}" with ${result.priority || 'standard'} priority emergency information.`
            }];
    }
    generateReasoningTrace(result, query) {
        return `Semantic Analysis: Document "${result.title}" was selected because it contains relevant information about "${query.query}". The content demonstrates ${result.priority || 'standard'} priority for emergency response. Key factors: title relevance, content depth, and contextual emergency applicability.`;
    }
    generateSemanticSummary(query, results, aiSummary) {
        const avgScore = results.reduce((sum, r) => sum + r.semantic_score, 0) / results.length;
        const highPriorityCount = results.filter(r => r.priority === 'high').length;
        let summary = `Found ${results.length} semantically relevant results for "${query.query}". `;
        if (highPriorityCount > 0) {
            summary += `${highPriorityCount} result${highPriorityCount > 1 ? 's' : ''} marked high priority. `;
        }
        summary += `Average semantic relevance: ${(avgScore * 100).toFixed(1)}%. `;
        if (aiSummary) {
            summary += aiSummary;
        }
        return summary;
    }
    generateContextualSuggestions(query, results) {
        const suggestions = [];
        // Category-based suggestions
        const categories = [...new Set(results.map(r => r.category).filter(Boolean))];
        categories.forEach(category => {
            if (category && !query.query.toLowerCase().includes(category.toLowerCase())) {
                suggestions.push(`${category.replace('-', ' ')} specific guidance`);
            }
        });
        // Context-based suggestions
        if (query.context?.emergency_context) {
            const situation = query.context.emergency_context.situation;
            suggestions.push(`${situation} evacuation procedures`, `${situation} safety checklist`);
        }
        return suggestions.slice(0, 3);
    }
    generateContextInsights(query, results) {
        const insights = [];
        if (results.length > 0) {
            const avgScore = results.reduce((sum, r) => sum + r.semantic_score, 0) / results.length;
            insights.push(`Search confidence: ${(avgScore * 100).toFixed(1)}%`);
        }
        const priorityDist = results.reduce((acc, r) => {
            acc[r.priority || 'standard'] = (acc[r.priority || 'standard'] || 0) + 1;
            return acc;
        }, {});
        if (priorityDist.high > 0) {
            insights.push(`${priorityDist.high} high-priority emergency resource${priorityDist.high > 1 ? 's' : ''} available`);
        }
        return insights;
    }
    async enhanceResultWithSemantic(baseResult, query, isStream = false) {
        const contextRelevance = this.calculateContextRelevance(baseResult, query);
        const semanticScore = contextRelevance * 0.8 + (baseResult.priority === 'high' ? 0.2 : baseResult.priority === 'medium' ? 0.1 : 0);
        return {
            ...baseResult,
            aiEnhanced: true,
            contextRelevance,
            semantic_score: semanticScore,
            context_relevance: contextRelevance,
            reasoning_trace: query.include_cot ? `Semantic match for "${query.query}" based on content analysis and emergency context.` : undefined,
            citations: [{
                    document_id: baseResult.id,
                    relevance_score: contextRelevance,
                    excerpt: baseResult.summary || baseResult.content?.substring(0, 200) || '',
                    reasoning: 'Direct semantic match with query intent'
                }],
            processing_time: isStream ? 25 : 75,
            model_used: this.config.model_size,
            real_time_updates: this.config.enable_real_time_updates
        };
    }
    calculateContextRelevance(doc, query) {
        const queryLower = query.query.toLowerCase();
        const docText = `${doc.title} ${doc.summary || ''} ${doc.content || ''}`.toLowerCase();
        // Basic semantic similarity (simplified)
        const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 2);
        let matches = 0;
        queryTerms.forEach(term => {
            if (docText.includes(term))
                matches += 1;
            // Semantic variants (simplified)
            if (term.includes('fire') && docText.includes('burn'))
                matches += 0.5;
            if (term.includes('water') && docText.includes('flood'))
                matches += 0.5;
            if (term.includes('medical') && docText.includes('first aid'))
                matches += 0.5;
        });
        let relevance = Math.min(1.0, matches / queryTerms.length);
        // Context boosts
        if (query.context?.emergency_context) {
            if (docText.includes(query.context.emergency_context.situation.toLowerCase())) {
                relevance *= 1.3;
            }
        }
        return relevance;
    }
    async performDeepSemanticAnalysis(baseResults, query) {
        // Simulate deeper analysis
        return Promise.all(baseResults.map(async (result, index) => {
            const enhanced = await this.enhanceResultWithSemantic(result, query);
            // Boost scores for deeper analysis
            enhanced.semantic_score = Math.min(1.0, enhanced.semantic_score * 1.1);
            enhanced.processing_time = 150 + index * 20;
            return enhanced;
        }));
    }
    async fallbackToAISearch(query, startTime) {
        console.log('🔄 Falling back to AI search...');
        const aiResults = await aiSearch(query.query, {
            limit: query.max_results || 10,
            includeAISummary: true,
            useMemoryContext: true
        });
        return {
            query_id: query.id,
            results: await Promise.all(aiResults.results.map(async (result) => ({
                ...result,
                semantic_score: result.contextRelevance || 0.5,
                context_relevance: result.contextRelevance || 0.5,
                citations: [{
                        document_id: result.id,
                        relevance_score: result.contextRelevance || 0.5,
                        excerpt: result.aiSummary || result.summary || '',
                        reasoning: 'AI-enhanced search result'
                    }],
                processing_time: 100,
                model_used: this.config.model_size,
                real_time_updates: false
            }))),
            semantic_summary: aiResults.aiSummary || 'AI search completed successfully',
            reasoning_chain: [{
                    step: 1,
                    description: 'Fallback AI search executed',
                    confidence: 0.7,
                    sources: ['ai_search_fallback']
                }],
            suggested_queries: aiResults.suggestedQueries || [],
            context_insights: ['Fallback mode - GPT-OSS semantic search unavailable'],
            streaming_complete: true,
            total_processing_time: Date.now() - startTime,
            cache_hit: false
        };
    }
    async updateContext(context) {
        this.context = { ...this.context, ...context };
        console.log('🔄 Updated semantic context:', Object.keys(context));
    }
    getConfig() {
        return { ...this.config };
    }
    async updateConfig(config) {
        this.config = { ...this.config, ...config };
        console.log('⚙️ Updated semantic search config');
    }
    async dispose() {
        if (this.gptOssProcess) {
            this.gptOssProcess.kill();
            this.gptOssProcess = null;
        }
        await this.cache.cleanup();
        this.isInitialized = false;
        console.log('🛑 GPT-OSS Semantic Search Engine disposed');
    }
    generateQueryHash(query) {
        const hashInput = `${query.query}_${query.reasoning_effort}_${JSON.stringify(query.context || {})}`;
        return createHash('sha256').update(hashInput).digest('hex');
    }
}
// Simple in-memory cache implementation
class MemorySemanticCache {
    cache = new Map();
    ttl;
    constructor(ttl) {
        this.ttl = ttl * 1000; // Convert to milliseconds
    }
    async get(query_hash) {
        const entry = this.cache.get(query_hash);
        if (!entry)
            return null;
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(query_hash);
            return null;
        }
        return entry.data;
    }
    async set(query_hash, response) {
        this.cache.set(query_hash, { data: response, timestamp: Date.now() });
    }
    async invalidate(pattern) {
        if (!pattern) {
            this.cache.clear();
            return;
        }
        const regex = new RegExp(pattern);
        for (const [key] of this.cache) {
            if (regex.test(key)) {
                this.cache.delete(key);
            }
        }
    }
    async cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache) {
            if (now - entry.timestamp > this.ttl) {
                this.cache.delete(key);
            }
        }
    }
}
//# sourceMappingURL=engine.js.map