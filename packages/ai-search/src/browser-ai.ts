/**
 * Browser-only AI Search Implementation
 * This module is designed to work only in the browser environment
 * and avoids Node.js-specific dependencies
 */

import type { Doc } from '../../search-core/src/index'
import { search as baseSearch, initIndex } from '../../search-core/src/index'
import type { AISearchSettings, SearchContext, SearchMemory } from './memory'

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

class BrowserAISearch {
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
    // Only initialize in browser environment
    if (typeof window === 'undefined') {
      console.log('🚫 BrowserAISearch: Not in browser environment, skipping initialization')
      return
    }
  }

  async initialize(): Promise<void> {
    if (typeof window === 'undefined') {
      console.log('🚫 BrowserAISearch: Cannot initialize outside browser')
      return
    }

    if (this.isInitialized) return

    try {
      console.log('🤖 Initializing Browser AI Search...')
      
      // Initialize base search index
      await initIndex()
      
      // Load settings from localStorage
      this.loadSettingsFromStorage()
      
      this.isInitialized = true
      console.log('✅ Browser AI Search initialized (without AI models)')
    } catch (error) {
      console.error('❌ Failed to initialize Browser AI Search:', error)
      throw error
    }
  }

  private loadSettingsFromStorage(): void {
    try {
      const saved = localStorage.getItem('ai-search-settings')
      if (saved) {
        const parsedSettings = JSON.parse(saved)
        this.settings = { ...this.settings, ...parsedSettings }
      }
    } catch (error) {
      console.warn('Could not load settings from localStorage:', error)
    }
  }

  private saveSettingsToStorage(): void {
    try {
      localStorage.setItem('ai-search-settings', JSON.stringify(this.settings))
    } catch (error) {
      console.warn('Could not save settings to localStorage:', error)
    }
  }

  async search(query: string, options: {
    limit?: number
    includeAISummary?: boolean
    useMemoryContext?: boolean
  } = {}): Promise<AISearchResponse> {
    if (typeof window === 'undefined') {
      throw new Error('BrowserAISearch can only be used in browser environment')
    }

    if (!this.isInitialized) {
      await this.initialize()
    }

    const startTime = Date.now()
    const { limit = 10, includeAISummary = true, useMemoryContext = true } = options

    try {
      // Get search context from localStorage
      const searchContext = useMemoryContext && this.settings.enableContextMemory
        ? this.getSearchContextFromStorage(query)
        : { previousQueries: [], relatedTopics: [], userPreferences: {} }

      // Perform base search
      const baseResults = await baseSearch(query, { limit })

      // For now, return basic results without AI enhancement
      // In the future, we could add client-side AI models or API calls here
      const results: AISearchResult[] = baseResults.map(result => ({
        ...result,
        aiEnhanced: false,
        contextRelevance: 0.5, // Default relevance
      }))

      // Generate simple AI summary (rule-based for now)
      const aiSummary = includeAISummary && this.settings.enableAISummaries
        ? this.generateBasicSummary(query, results)
        : ''

      // Generate basic suggested queries
      const suggestedQueries = this.generateBasicSuggestedQueries(query, searchContext)

      // Store search in localStorage
      if (this.settings.enableContextMemory) {
        this.storeSearchInStorage(query, results, searchContext)
      }

      const processingTime = Date.now() - startTime

      return {
        results,
        aiSummary,
        searchContext,
        suggestedQueries,
        processingTime
      }
    } catch (error) {
      console.error('Browser AI Search error:', error)
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

  private getSearchContextFromStorage(query: string): SearchContext {
    try {
      const memories = localStorage.getItem('ai-search-memories')
      if (!memories) {
        return { previousQueries: [], relatedTopics: [], userPreferences: {} }
      }

      const parsed = JSON.parse(memories)
      const recent = parsed.slice(-10) // Last 10 searches

      return {
        previousQueries: recent.map((m: any) => m.query),
        relatedTopics: this.extractRelatedTopics(recent, query),
        userPreferences: {}
      }
    } catch (error) {
      console.warn('Failed to get search context from storage:', error)
      return { previousQueries: [], relatedTopics: [], userPreferences: {} }
    }
  }

  private storeSearchInStorage(query: string, results: AISearchResult[], context: SearchContext): void {
    try {
      const memories = localStorage.getItem('ai-search-memories')
      const parsed = memories ? JSON.parse(memories) : []
      
      parsed.push({
        query,
        results: results.slice(0, 3), // Store only top 3 results to save space
        context,
        timestamp: Date.now()
      })

      // Keep only recent memories (last 50)
      const recent = parsed.slice(-50)
      localStorage.setItem('ai-search-memories', JSON.stringify(recent))
    } catch (error) {
      console.warn('Failed to store search in storage:', error)
    }
  }

  private extractRelatedTopics(memories: any[], currentQuery: string): string[] {
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

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'how', 'what', 'where', 'when', 'why'
    ])
    return stopWords.has(word)
  }

  private generateBasicSummary(query: string, results: AISearchResult[]): string {
    if (results.length === 0) {
      return `No results found for "${query}".`
    }

    const resultCount = results.length
    const categories = new Set(results.map(r => r.category).filter(Boolean))
    const categoryText = categories.size > 0 
      ? ` across ${Array.from(categories).slice(0, 3).join(', ')}`
      : ''

    return `Found ${resultCount} result${resultCount > 1 ? 's' : ''} for "${query}"${categoryText}.`
  }

  private generateBasicSuggestedQueries(query: string, context: SearchContext): string[] {
    const suggestions: string[] = []
    const queryWords = query.toLowerCase().split(/\W+/)
    
    // Add some basic query variations
    if (queryWords.length > 1) {
      suggestions.push(queryWords.slice(0, -1).join(' ')) // Remove last word
    }
    
    // Add related topics from context
    context.relatedTopics.slice(0, 2).forEach(topic => {
      if (!query.toLowerCase().includes(topic)) {
        suggestions.push(`${query} ${topic}`)
      }
    })

    return suggestions.slice(0, 3)
  }

  async updateSettings(newSettings: Partial<AISearchSettings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings }
    this.saveSettingsToStorage()
  }

  async getSettings(): Promise<AISearchSettings> {
    return { ...this.settings }
  }

  async clearMemory(): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ai-search-memories')
    }
  }

  async getSearchAnalytics(): Promise<{
    totalSearches: number
    topQueries: Array<{ query: string; count: number }>
    averageResultsCount: number
    memoryUsage: number
  }> {
    try {
      const memories = localStorage.getItem('ai-search-memories')
      if (!memories) {
        return { totalSearches: 0, topQueries: [], averageResultsCount: 0, memoryUsage: 0 }
      }

      const parsed = JSON.parse(memories)
      const queryCounts = new Map<string, number>()
      let totalResults = 0

      parsed.forEach((memory: any) => {
        queryCounts.set(memory.query, (queryCounts.get(memory.query) || 0) + 1)
        totalResults += memory.results?.length || 0
      })

      const topQueries = Array.from(queryCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([query, count]) => ({ query, count }))

      return {
        totalSearches: parsed.length,
        topQueries,
        averageResultsCount: parsed.length > 0 ? Math.round(totalResults / parsed.length) : 0,
        memoryUsage: Math.round(memories.length / 1024) // KB
      }
    } catch (error) {
      console.warn('Failed to get analytics:', error)
      return { totalSearches: 0, topQueries: [], averageResultsCount: 0, memoryUsage: 0 }
    }
  }
}

// Export singleton instance
export const browserAISearch = new BrowserAISearch()

// Export convenience functions
export const aiSearch = (query: string, options?: any) => browserAISearch.search(query, options)
export const initAISearch = () => browserAISearch.initialize()
export const updateAISearchSettings = (settings: Partial<AISearchSettings>) => 
  browserAISearch.updateSettings(settings)
export const getAISearchSettings = () => browserAISearch.getSettings()
export const clearSearchMemory = () => browserAISearch.clearMemory()
export const getSearchAnalytics = () => browserAISearch.getSearchAnalytics()
