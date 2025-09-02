import type { Doc } from 'search-core'
import { search as baseSearch, initIndex, addDocs } from 'search-core'
import { AISearchDB, type SearchContext, type SearchMemory, type AISearchSettings } from './memory'
import { 
  simpleAISearch, 
  initSimpleAISearch, 
  updateSimpleAISearchSettings,
  getSimpleAISearchSettings,
  clearSimpleSearchMemory,
  getSimpleSearchAnalytics
} from './simple-ai'

// Dynamic import for transformers to avoid build issues
type Pipeline = any
let transformersLoaded = false

export type { SearchContext, SearchMemory, AISearchSettings }

export interface AISearchResult extends Doc {
  aiEnhanced?: boolean
  contextRelevance?: number
  aiSummary?: string
  suggestedQueries?: string[]
}

export interface AISearchResponse {
  results: AISearchResult[]
  aiSummary: string
  searchContext: SearchContext
  suggestedQueries: string[]
  processingTime: number
}

class AISearchEngine {
  private textGenerator: Pipeline | null = null
  private textEmbedder: Pipeline | null = null
  private db: AISearchDB
  private isInitialized = false
  private settings: AISearchSettings = {
    memoryRetentionHours: 24,
    maxContextLength: 5000,
    enableContextMemory: true,
    enableAISummaries: true,
    aiModelPath: 'Xenova/gpt2',
    embeddingModelPath: 'Xenova/all-MiniLM-L6-v2'
  }

  constructor() {
    this.db = new AISearchDB()
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    console.log('🤖 Initializing AI Search Engine...')

    try {
      // Initialize base search index
      await initIndex()

      // Load AI models for offline use
      await this.loadModels()

      // Initialize settings
      await this.loadSettings()

      this.isInitialized = true
      console.log('✅ AI Search Engine initialized')
    } catch (error) {
      console.error('❌ Failed to initialize AI Search Engine:', error)
      throw error
    }
  }

  private async loadModels(): Promise<void> {
    try {
      // Dynamic import of transformers.js to avoid SSR issues
      const { pipeline } = await import('@xenova/transformers')
      
      console.log('📦 Loading AI models...')
      
      // Load text generation model (lightweight GPT-2 for offline use)
      this.textGenerator = await pipeline(
        'text-generation',
        this.settings.aiModelPath,
        { 
          cache_dir: './.ai-models',
          local_files_only: false, // Allow initial download
          progress_callback: (data: any) => {
            if (data.status === 'progress') {
              console.log(`Loading model: ${Math.round((data.loaded / data.total) * 100)}%`)
            }
          }
        }
      )

      // Load embedding model for semantic search
      this.textEmbedder = await pipeline(
        'feature-extraction',
        this.settings.embeddingModelPath,
        { 
          cache_dir: './.ai-models',
          local_files_only: false,
          progress_callback: (data: any) => {
            if (data.status === 'progress') {
              console.log(`Loading embedding model: ${Math.round((data.loaded / data.total) * 100)}%`)
            }
          }
        }
      )

      transformersLoaded = true
      console.log('✅ AI models loaded successfully')
    } catch (error) {
      console.warn('⚠️ AI models failed to load, continuing with basic search:', error)
      // Continue without AI features if models fail to load
      this.textGenerator = null
      this.textEmbedder = null
    }
  }

  async updateSettings(newSettings: Partial<AISearchSettings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings }
    await this.db.updateSettings(this.settings)
  }

  async getSettings(): Promise<AISearchSettings> {
    return { ...this.settings }
  }

  private async loadSettings(): Promise<void> {
    try {
      const savedSettings = await this.db.getSettings()
      if (savedSettings) {
        this.settings = { ...this.settings, ...savedSettings }
      }
    } catch (error) {
      console.warn('Could not load saved settings, using defaults')
    }
  }

  async search(query: string, options: {
    limit?: number
    includeAISummary?: boolean
    useMemoryContext?: boolean
  } = {}): Promise<AISearchResponse> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const startTime = Date.now()
    const { limit = 10, includeAISummary = true, useMemoryContext = true } = options

    try {
      // Get search context from memory
      const searchContext = useMemoryContext && this.settings.enableContextMemory
        ? await this.getSearchContext(query)
        : { previousQueries: [], relatedTopics: [], userPreferences: {} }

      // Perform base search
      const baseResults = await baseSearch(query, { limit: limit * 2 }) // Get more results for AI filtering

      // Enhance results with AI if models are loaded
      let aiResults: AISearchResult[] = baseResults
      let aiSummary = ''
      let suggestedQueries: string[] = []

      if (this.textGenerator && this.textEmbedder) {
        aiResults = await this.enhanceResultsWithAI(baseResults, query, searchContext)
        
        if (includeAISummary && this.settings.enableAISummaries) {
          aiSummary = await this.generateSearchSummary(query, aiResults, searchContext)
        }

        suggestedQueries = await this.generateSuggestedQueries(query, searchContext)
      }

      // Store search in memory
      if (this.settings.enableContextMemory) {
        await this.storeSearchMemory(query, aiResults, searchContext)
      }

      // Clean up expired memories
      await this.cleanupExpiredMemories()

      const processingTime = Date.now() - startTime

      return {
        results: aiResults.slice(0, limit),
        aiSummary,
        searchContext,
        suggestedQueries,
        processingTime
      }
    } catch (error) {
      console.error('AI Search error:', error)
      // Fallback to base search if AI fails
      const baseResults = await baseSearch(query, { limit })
      return {
        results: baseResults,
        aiSummary: '',
        searchContext: { previousQueries: [], relatedTopics: [], userPreferences: {} },
        suggestedQueries: [],
        processingTime: Date.now() - startTime
      }
    }
  }

  private async enhanceResultsWithAI(
    results: Doc[],
    query: string,
    context: SearchContext
  ): Promise<AISearchResult[]> {
    const enhancedResults: AISearchResult[] = []

    for (const result of results) {
      try {
        // Calculate semantic relevance using embeddings
        const contextRelevance = await this.calculateContextRelevance(result, query, context)

        // Generate AI summary if content is available
        let aiSummary: string | undefined
        if (result.content && this.settings.enableAISummaries) {
          aiSummary = await this.generateContentSummary(result.content, query)
        }

        enhancedResults.push({
          ...result,
          aiEnhanced: true,
          contextRelevance,
          aiSummary
        })
      } catch (error) {
        console.warn('Failed to enhance result with AI:', error)
        enhancedResults.push(result)
      }
    }

    // Sort by context relevance and original search score
    return enhancedResults.sort((a, b) => {
      const aScore = (a.contextRelevance || 0) * 0.6 + 0.4 // Weighted combination
      const bScore = (b.contextRelevance || 0) * 0.6 + 0.4
      return bScore - aScore
    })
  }

  private async calculateContextRelevance(
    doc: Doc,
    query: string,
    context: SearchContext
  ): Promise<number> {
    if (!this.textEmbedder) return 0.5 // Default neutral score

    try {
      // Create embeddings for document and query+context
      const docText = `${doc.title} ${doc.summary || ''} ${doc.content || ''}`.slice(0, 512)
      const contextText = `${query} ${context.relatedTopics.join(' ')} ${context.previousQueries.slice(0, 3).join(' ')}`

      const docEmbedding = await this.textEmbedder(docText)
      const contextEmbedding = await this.textEmbedder(contextText)

      // Calculate cosine similarity
      const similarity = this.cosineSimilarity(
        Array.from(docEmbedding.data),
        Array.from(contextEmbedding.data)
      )

      return Math.max(0, Math.min(1, similarity))
    } catch (error) {
      console.warn('Failed to calculate context relevance:', error)
      return 0.5
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
    return dotProduct / (magnitudeA * magnitudeB)
  }

  private async generateContentSummary(content: string, query: string): Promise<string> {
    if (!this.textGenerator) return ''

    try {
      const prompt = `Summarize the following content in relation to the query "${query}":\n\n${content.slice(0, 1000)}\n\nSummary:`

      const result = await this.textGenerator(prompt, {
        max_length: 100,
        temperature: 0.7,
        do_sample: true
      })

      return result[0]?.generated_text?.replace(prompt, '').trim() || ''
    } catch (error) {
      console.warn('Failed to generate content summary:', error)
      return ''
    }
  }

  private async generateSearchSummary(
    query: string,
    results: AISearchResult[],
    context: SearchContext
  ): Promise<string> {
    if (!this.textGenerator || results.length === 0) return ''

    try {
      const resultSummaries = results
        .slice(0, 5)
        .map(r => `${r.title}: ${r.summary || 'No summary available'}`)
        .join('\n')

      const contextInfo = context.relatedTopics.length > 0
        ? `Related topics from previous searches: ${context.relatedTopics.slice(0, 3).join(', ')}`
        : ''

      const prompt = `Based on the search query "${query}" and the following results, provide a brief summary of the key findings:

${resultSummaries}

${contextInfo}

Summary:`

      const result = await this.textGenerator(prompt, {
        max_length: 150,
        temperature: 0.6,
        do_sample: true
      })

      return result[0]?.generated_text?.replace(prompt, '').trim() || ''
    } catch (error) {
      console.warn('Failed to generate search summary:', error)
      return ''
    }
  }

  private async generateSuggestedQueries(
    query: string,
    context: SearchContext
  ): Promise<string[]> {
    if (!this.textGenerator) return []

    try {
      const contextTopics = context.relatedTopics.slice(0, 3).join(', ')
      const prompt = `Based on the search query "${query}" and related topics: ${contextTopics}, suggest 3 related search queries:

1.`

      const result = await this.textGenerator(prompt, {
        max_length: 200,
        temperature: 0.8,
        do_sample: true
      })

      const suggestions = result[0]?.generated_text
        ?.replace(prompt, '')
        .split(/\d+\./)
        .map(s => s.trim())
        .filter(s => s.length > 0 && s.length < 100)
        .slice(0, 3) || []

      return suggestions
    } catch (error) {
      console.warn('Failed to generate suggested queries:', error)
      return []
    }
  }

  private async getSearchContext(query: string): Promise<SearchContext> {
    const memories = await this.db.getRecentSearches(10)
    const relatedTopics = await this.extractRelatedTopics(memories, query)

    return {
      previousQueries: memories.map(m => m.query),
      relatedTopics,
      userPreferences: await this.getUserPreferences(memories)
    }
  }

  private async extractRelatedTopics(memories: SearchMemory[], currentQuery: string): Promise<string[]> {
    // Simple keyword extraction from previous searches
    const allQueries = memories.map(m => m.query).join(' ')
    const words = allQueries.toLowerCase().split(/\W+/)
    const wordCounts = new Map<string, number>()

    words.forEach(word => {
      if (word.length > 3 && !this.isStopWord(word)) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
      }
    })

    return Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word)
  }

  private async getUserPreferences(memories: SearchMemory[]): Promise<Record<string, any>> {
    // Analyze search patterns to infer preferences
    const categories = new Map<string, number>()
    
    memories.forEach(memory => {
      memory.results.forEach(result => {
        if (result.category) {
          categories.set(result.category, (categories.get(result.category) || 0) + 1)
        }
      })
    })

    return {
      preferredCategories: Array.from(categories.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([category]) => category)
    }
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'
    ])
    return stopWords.has(word)
  }

  private async storeSearchMemory(
    query: string,
    results: AISearchResult[],
    context: SearchContext
  ): Promise<void> {
    try {
      await this.db.addSearchMemory({
        query,
        results,
        context,
        timestamp: Date.now()
      })
    } catch (error) {
      console.warn('Failed to store search memory:', error)
    }
  }

  private async cleanupExpiredMemories(): Promise<void> {
    try {
      const expiryTime = Date.now() - (this.settings.memoryRetentionHours * 60 * 60 * 1000)
      await this.db.cleanupExpiredMemories(expiryTime)
    } catch (error) {
      console.warn('Failed to cleanup expired memories:', error)
    }
  }

  async clearMemory(): Promise<void> {
    await this.db.clearAllMemories()
  }

  async getSearchAnalytics(): Promise<{
    totalSearches: number
    topQueries: Array<{ query: string; count: number }>
    averageResultsCount: number
    memoryUsage: number
  }> {
    return await this.db.getAnalytics()
  }
}

// Export singleton instance
export const aiSearchEngine = new AISearchEngine()

// Smart wrapper that tries full AI search first, falls back to simple AI
class SmartAISearch {
  private useFullAI = true
  
  async search(query: string, options?: any): Promise<AISearchResponse> {
    if (this.useFullAI) {
      try {
        return await aiSearchEngine.search(query, options)
      } catch (error) {
        console.warn('Full AI search failed, falling back to simple AI:', error)
        this.useFullAI = false
        return await simpleAISearch(query, options)
      }
    } else {
      return await simpleAISearch(query, options)
    }
  }
  
  async initialize(): Promise<void> {
    try {
      await aiSearchEngine.initialize()
      this.useFullAI = true
    } catch (error) {
      console.warn('Full AI initialization failed, using simple AI:', error)
      this.useFullAI = false
      await initSimpleAISearch()
    }
  }
  
  async updateSettings(settings: Partial<AISearchSettings>): Promise<void> {
    if (this.useFullAI) {
      return await aiSearchEngine.updateSettings(settings)
    } else {
      return await updateSimpleAISearchSettings(settings)
    }
  }
  
  async getSettings(): Promise<AISearchSettings> {
    if (this.useFullAI) {
      return await aiSearchEngine.getSettings()
    } else {
      return await getSimpleAISearchSettings()
    }
  }
  
  async clearMemory(): Promise<void> {
    if (this.useFullAI) {
      return await aiSearchEngine.clearMemory()
    } else {
      return await clearSimpleSearchMemory()
    }
  }
  
  async getSearchAnalytics(): Promise<any> {
    if (this.useFullAI) {
      return await aiSearchEngine.getSearchAnalytics()
    } else {
      return await getSimpleSearchAnalytics()
    }
  }
}

const smartAISearch = new SmartAISearch()

// Export convenience functions
export const aiSearch = (query: string, options?: any) => smartAISearch.search(query, options)
export const initAISearch = () => smartAISearch.initialize()
export const updateAISearchSettings = (settings: Partial<AISearchSettings>) => 
  smartAISearch.updateSettings(settings)
export const getAISearchSettings = () => smartAISearch.getSettings()
export const clearSearchMemory = () => smartAISearch.clearMemory()
export const getSearchAnalytics = () => smartAISearch.getSearchAnalytics()
