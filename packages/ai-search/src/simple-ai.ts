import type { Doc } from 'search-core'
import { search as baseSearch, initIndex } from 'search-core'
import { AISearchDB, type SearchContext, type SearchMemory, type AISearchSettings } from './memory'

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

class SimpleAISearchEngine {
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

    console.log('🤖 Initializing Simple AI Search Engine...')

    try {
      // Initialize base search index
      await initIndex()
      
      // Load settings
      await this.loadSettings()

      this.isInitialized = true
      console.log('✅ Simple AI Search Engine initialized')
    } catch (error) {
      console.error('❌ Failed to initialize Simple AI Search Engine:', error)
      throw error
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
      const baseResults = await baseSearch(query, { limit: limit * 2 })

      // Enhance results with simple AI techniques
      const aiResults = await this.enhanceResultsWithSimpleAI(baseResults, query, searchContext)
      
      // Generate simple AI summary
      const aiSummary = includeAISummary && this.settings.enableAISummaries
        ? this.generateSimpleSummary(query, aiResults, searchContext)
        : ''

      // Generate suggested queries
      const suggestedQueries = this.generateSimpleSuggestions(query, searchContext)

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
      console.error('Simple AI Search error:', error)
      // Fallback to base search
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

  private async enhanceResultsWithSimpleAI(
    results: Doc[],
    query: string,
    context: SearchContext
  ): Promise<AISearchResult[]> {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2)
    const contextTerms = context.relatedTopics.concat(context.previousQueries).join(' ').toLowerCase().split(/\s+/)

    return results.map(result => {
      // Calculate simple semantic relevance
      const contextRelevance = this.calculateSimpleRelevance(result, queryTerms, contextTerms)
      
      // Generate simple AI summary
      const aiSummary = this.settings.enableAISummaries 
        ? this.generateSimpleContentSummary(result, query)
        : undefined

      return {
        ...result,
        aiEnhanced: true,
        contextRelevance,
        aiSummary
      }
    }).sort((a, b) => (b.contextRelevance || 0) - (a.contextRelevance || 0))
  }

  private calculateSimpleRelevance(doc: Doc, queryTerms: string[], contextTerms: string[]): number {
    const docText = `${doc.title} ${doc.summary || ''} ${doc.content || ''}`.toLowerCase()
    const docTerms = docText.split(/\s+/)

    // Calculate term frequency matches
    let queryMatches = 0
    let contextMatches = 0

    queryTerms.forEach(term => {
      const matches = docTerms.filter(docTerm => docTerm.includes(term)).length
      queryMatches += matches
    })

    contextTerms.forEach(term => {
      if (term.length > 2) {
        const matches = docTerms.filter(docTerm => docTerm.includes(term)).length
        contextMatches += matches * 0.5 // Weight context matches less than direct query matches
      }
    })

    // Normalize and combine scores
    const totalMatches = queryMatches + contextMatches
    const docLength = docTerms.length
    const relevance = Math.min(1, totalMatches / Math.sqrt(docLength))

    // Boost for title matches
    let titleBoost = 1
    queryTerms.forEach(term => {
      if (doc.title.toLowerCase().includes(term)) {
        titleBoost += 0.3
      }
    })

    // Priority boost
    let priorityBoost = 1
    if (doc.priority === 'high') priorityBoost = 1.5
    else if (doc.priority === 'medium') priorityBoost = 1.2

    return Math.min(1, relevance * titleBoost * priorityBoost)
  }

  private generateSimpleContentSummary(doc: Doc, query: string): string {
    if (!doc.content) return ''

    const queryTerms = query.toLowerCase().split(/\s+/)
    const sentences = doc.content.split(/[.!?]+/).filter(s => s.trim().length > 20)
    
    // Find sentences that contain query terms
    const relevantSentences = sentences
      .map(sentence => {
        const lowerSentence = sentence.toLowerCase()
        const matches = queryTerms.filter(term => lowerSentence.includes(term)).length
        return { sentence: sentence.trim(), matches }
      })
      .filter(item => item.matches > 0)
      .sort((a, b) => b.matches - a.matches)
      .slice(0, 2)

    if (relevantSentences.length > 0) {
      const summary = relevantSentences.map(item => item.sentence).join(' ')
      return `Based on your search for "${query}": ${summary.slice(0, 200)}${summary.length > 200 ? '...' : ''}`
    }

    return `This document covers ${doc.category?.replace('-', ' ') || 'emergency'} information related to "${query}".`
  }

  private generateSimpleSummary(query: string, results: AISearchResult[], context: SearchContext): string {
    if (results.length === 0) return `No results found for "${query}".`

    const categories = new Map<string, number>()
    results.forEach(result => {
      if (result.category) {
        categories.set(result.category, (categories.get(result.category) || 0) + 1)
      }
    })

    const topCategory = Array.from(categories.entries())
      .sort((a, b) => b[1] - a[1])[0]

    const contextInfo = context.previousQueries.length > 0 
      ? ` Building on your previous searches, this` 
      : ' This'

    const categoryText = topCategory 
      ? ` focuses primarily on ${topCategory[0].replace('-', ' ')}`
      : ''

    return `Found ${results.length} relevant documents for "${query}".${contextInfo} search${categoryText} and provides actionable emergency preparedness information.`
  }

  private generateSimpleSuggestions(query: string, context: SearchContext): string[] {
    const suggestions: string[] = []
    const queryLower = query.toLowerCase()

    // Emergency-specific suggestions based on query content
    const emergencyMapping: Record<string, string[]> = {
      'earthquake': ['earthquake safety procedures', 'seismic preparedness kit', 'building evacuation routes'],
      'first aid': ['CPR techniques', 'wound care basics', 'emergency medical supplies'],
      'fire': ['fire evacuation plan', 'smoke safety procedures', 'fire extinguisher use'],
      'water': ['water purification methods', 'emergency water storage', 'hydration during emergencies'],
      'food': ['emergency food supplies', 'non-perishable meal planning', 'food safety during outages'],
      'power': ['power outage preparedness', 'backup generator safety', 'emergency lighting'],
      'communication': ['emergency contact plan', 'radio communication basics', 'cell phone backup power'],
      'weather': ['severe weather alerts', 'storm shelter procedures', 'hurricane preparedness'],
      'evacuation': ['evacuation route planning', 'emergency evacuation kit', 'family meeting points']
    }

    // Find relevant suggestions based on query
    for (const [key, values] of Object.entries(emergencyMapping)) {
      if (queryLower.includes(key)) {
        suggestions.push(...values.filter(v => !v.toLowerCase().includes(queryLower)))
      }
    }

    // Add context-based suggestions
    context.relatedTopics.forEach(topic => {
      if (topic.length > 3 && !queryLower.includes(topic)) {
        suggestions.push(`${topic} preparedness`)
      }
    })

    // Remove duplicates and return top 3
    return [...new Set(suggestions)].slice(0, 3)
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
export const simpleAISearchEngine = new SimpleAISearchEngine()

// Export convenience functions
export const simpleAISearch = (query: string, options?: any) => simpleAISearchEngine.search(query, options)
export const initSimpleAISearch = () => simpleAISearchEngine.initialize()
export const updateSimpleAISearchSettings = (settings: Partial<AISearchSettings>) => 
  simpleAISearchEngine.updateSettings(settings)
export const getSimpleAISearchSettings = () => simpleAISearchEngine.getSettings()
export const clearSimpleSearchMemory = () => simpleAISearchEngine.clearMemory()
export const getSimpleSearchAnalytics = () => simpleAISearchEngine.getSearchAnalytics()
