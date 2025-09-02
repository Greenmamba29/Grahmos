import type { Doc } from 'search-core'
import { search as baseSearch, initIndex, addDocs, getIndexStats } from 'search-core'

export interface AISearchResult extends Doc {
  aiEnhanced?: boolean
  contextRelevance?: number
  aiSummary?: string
}

export interface AISearchResponse {
  results: AISearchResult[]
  aiSummary: string
  searchContext: SearchContext
  suggestedQueries: string[]
  processingTime: number
}

export interface SearchContext {
  previousQueries: string[]
  relatedTopics: string[]
  userPreferences: Record<string, any>
}

export interface AISearchSettings {
  memoryRetentionHours: number
  maxContextLength: number
  enableContextMemory: boolean
  enableAISummaries: boolean
  aiModelPath: string
  embeddingModelPath: string
}

class OfflineAISearch {
  private isInitialized = false
  private searchHistory: string[] = []
  private settings: AISearchSettings = {
    memoryRetentionHours: 24,
    maxContextLength: 5000,
    enableContextMemory: true,
    enableAISummaries: true,
    aiModelPath: 'local-ai',
    embeddingModelPath: 'local-embedding'
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    console.log('🤖 Initializing Offline AI Search Engine...')
    
    try {
      // Initialize the base search index
      await initIndex()
      
      // Load emergency catalog data if not already loaded
      const stats = await getIndexStats()
      if (stats.totalDocs === 0) {
        try {
          const response = await fetch('/catalog.seed.json')
          const emergencyDocs: Doc[] = await response.json()
          await addDocs(emergencyDocs)
          console.log(`📚 Loaded ${emergencyDocs.length} emergency documents`)
        } catch (error) {
          console.warn('Failed to load catalog.seed.json, continuing without it:', error)
        }
      }

      this.isInitialized = true
      console.log('✅ Offline AI Search Engine initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize Offline AI Search Engine:', error)
      throw error
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
      // Add to search history for context
      if (query.trim() && !this.searchHistory.includes(query.toLowerCase())) {
        this.searchHistory.unshift(query.toLowerCase())
        this.searchHistory = this.searchHistory.slice(0, 10) // Keep last 10 queries
      }

      // Get search context from history
      const searchContext = this.getSearchContext(query)

      // Perform base search
      const baseResults = await baseSearch(query, { limit: limit * 2 }) // Get more results for AI filtering

      // Enhance results with offline AI techniques
      const aiResults = this.enhanceResultsWithOfflineAI(baseResults, query, searchContext)
      
      // Generate AI summary
      const aiSummary = includeAISummary && this.settings.enableAISummaries
        ? this.generateOfflineAISummary(query, aiResults, searchContext)
        : ''

      // Generate suggested queries
      const suggestedQueries = this.generateOfflineSuggestions(query, searchContext)

      const processingTime = Date.now() - startTime

      return {
        results: aiResults.slice(0, limit),
        aiSummary,
        searchContext,
        suggestedQueries,
        processingTime
      }
    } catch (error) {
      console.error('Offline AI Search error:', error)
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

  private getSearchContext(query: string): SearchContext {
    const relatedTopics = this.extractRelatedTopics(query)
    
    return {
      previousQueries: this.searchHistory.slice(0, 5),
      relatedTopics,
      userPreferences: {
        preferredCategories: this.getPreferredCategories()
      }
    }
  }

  private extractRelatedTopics(query: string): string[] {
    const queryTerms = query.toLowerCase().split(/\s+/)
    const emergencyTerms = [
      'emergency', 'first aid', 'earthquake', 'fire', 'flood', 'evacuation',
      'medical', 'safety', 'disaster', 'preparedness', 'survival', 'water',
      'food', 'shelter', 'communication', 'power', 'gas', 'hurricane', 'tornado'
    ]
    
    return emergencyTerms.filter(term => 
      queryTerms.some(qTerm => term.includes(qTerm) || qTerm.includes(term))
    ).slice(0, 5)
  }

  private getPreferredCategories(): string[] {
    // Simple frequency analysis of search history
    const categoryTerms = {
      'medical': ['first aid', 'cpr', 'bleeding', 'medical', 'health'],
      'natural-disaster': ['earthquake', 'fire', 'flood', 'hurricane', 'tornado'],
      'safety': ['safety', 'evacuation', 'escape', 'emergency'],
      'survival': ['water', 'food', 'supplies', 'kit', 'shelter'],
      'utilities': ['power', 'gas', 'electricity', 'outage'],
      'planning': ['plan', 'prepare', 'communication', 'contact']
    }

    const categoryScores: Record<string, number> = {}
    
    for (const [category, terms] of Object.entries(categoryTerms)) {
      categoryScores[category] = 0
      for (const term of terms) {
        categoryScores[category] += this.searchHistory.filter(h => h.includes(term)).length
      }
    }

    return Object.entries(categoryScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category]) => category)
  }

  private enhanceResultsWithOfflineAI(
    results: Doc[],
    query: string,
    context: SearchContext
  ): AISearchResult[] {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2)
    
    return results.map(result => {
      // Calculate context relevance based on previous searches and content
      const contextRelevance = this.calculateOfflineRelevance(result, query, context)
      
      // Generate simple AI summary using pattern matching
      const aiSummary = this.settings.enableAISummaries 
        ? this.generateOfflineContentSummary(result, query)
        : undefined

      return {
        ...result,
        aiEnhanced: true,
        contextRelevance,
        aiSummary
      }
    }).sort((a, b) => (b.contextRelevance || 0) - (a.contextRelevance || 0))
  }

  private calculateOfflineRelevance(doc: Doc, query: string, context: SearchContext): number {
    const docText = `${doc.title} ${doc.summary || ''} ${doc.content || ''}`.toLowerCase()
    const queryTerms = query.toLowerCase().split(/\s+/)
    
    let relevanceScore = 0
    
    // Direct query term matches
    queryTerms.forEach(term => {
      if (term.length > 2) {
        const termCount = (docText.match(new RegExp(term, 'g')) || []).length
        relevanceScore += termCount * 2
      }
    })
    
    // Context relevance from related topics
    context.relatedTopics.forEach(topic => {
      if (docText.includes(topic)) {
        relevanceScore += 1
      }
    })
    
    // Category preference boost
    if (doc.category && context.userPreferences.preferredCategories?.includes(doc.category)) {
      relevanceScore *= 1.3
    }
    
    // Priority boost
    if (doc.priority === 'high') relevanceScore *= 1.5
    else if (doc.priority === 'medium') relevanceScore *= 1.2
    
    // Title match boost
    if (doc.title.toLowerCase().includes(query.toLowerCase())) {
      relevanceScore *= 1.4
    }
    
    // Normalize to 0-1 range
    return Math.min(1, relevanceScore / 10)
  }

  private generateOfflineContentSummary(doc: Doc, query: string): string {
    if (!doc.content) return doc.summary || ''

    const queryTerms = query.toLowerCase().split(/\s+/)
    const sentences = doc.content.split(/[.!?]+/).filter(s => s.trim().length > 20)
    
    // Find sentences that contain query terms
    const relevantSentences = sentences
      .map(sentence => {
        const lowerSentence = sentence.toLowerCase()
        const matches = queryTerms.filter(term => 
          term.length > 2 && lowerSentence.includes(term)
        ).length
        return { sentence: sentence.trim(), matches }
      })
      .filter(item => item.matches > 0)
      .sort((a, b) => b.matches - a.matches)
      .slice(0, 2)

    if (relevantSentences.length > 0) {
      const summary = relevantSentences.map(item => item.sentence).join(' ')
      return `Most relevant to "${query}": ${summary.slice(0, 200)}${summary.length > 200 ? '...' : ''}`
    }

    // Fallback to summary or category-based response
    if (doc.summary) {
      return doc.summary
    }

    return `This ${doc.category?.replace('-', ' ') || 'emergency'} resource addresses "${query}" with essential information and procedures.`
  }

  private generateOfflineAISummary(query: string, results: AISearchResult[], context: SearchContext): string {
    if (results.length === 0) return `No results found for "${query}". Try different terms or check the mapping tab for visual information.`

    const categories = new Map<string, number>()
    results.forEach(result => {
      if (result.category) {
        categories.set(result.category, (categories.get(result.category) || 0) + 1)
      }
    })

    const topCategory = Array.from(categories.entries())
      .sort((a, b) => b[1] - a[1])[0]

    const contextInfo = context.previousQueries.length > 0 
      ? ` Building on your search history` 
      : ''

    const categoryText = topCategory 
      ? `, focusing on ${topCategory[0].replace('-', ' ')}`
      : ''

    const priorityCount = results.filter(r => r.priority === 'high').length

    let priorityNote = ''
    if (priorityCount > 0) {
      priorityNote = ` ${priorityCount} result${priorityCount > 1 ? 's are' : ' is'} marked high priority for immediate attention.`
    }

    return `Found ${results.length} relevant result${results.length > 1 ? 's' : ''} for "${query}".${contextInfo}${categoryText}${priorityNote} These resources provide actionable emergency preparedness guidance.`
  }

  private generateOfflineSuggestions(query: string, context: SearchContext): string[] {
    const suggestions: string[] = []
    const queryLower = query.toLowerCase()

    // Emergency-specific suggestions based on query content
    const emergencyMapping: Record<string, string[]> = {
      'earthquake': ['earthquake preparedness checklist', 'building safety during earthquakes', 'earthquake emergency kit'],
      'first aid': ['CPR step by step', 'bleeding control techniques', 'emergency medical supplies'],
      'fire': ['home fire escape plan', 'wildfire evacuation', 'fire extinguisher use'],
      'water': ['water storage guidelines', 'water purification methods', 'emergency hydration'],
      'food': ['emergency food supplies', '72-hour food kit', 'food safety in outages'],
      'power': ['power outage safety', 'generator safety', 'emergency lighting'],
      'communication': ['emergency contact plan', 'emergency radio', 'cell phone emergency'],
      'weather': ['severe weather safety', 'hurricane preparation', 'tornado shelter'],
      'evacuation': ['evacuation route planning', 'evacuation supplies', 'family meeting points'],
      'medical': ['emergency medications', 'medical emergency response', 'health emergency kit'],
      'supplies': ['emergency kit essentials', '72-hour kit', 'emergency preparedness supplies']
    }

    // Find relevant suggestions based on query
    for (const [key, values] of Object.entries(emergencyMapping)) {
      if (queryLower.includes(key)) {
        suggestions.push(...values.filter(v => !v.toLowerCase().includes(queryLower)))
      }
    }

    // Add context-based suggestions from search history
    const contextSuggestions = context.relatedTopics
      .filter(topic => !queryLower.includes(topic))
      .map(topic => `${topic} safety procedures`)
      .slice(0, 2)
    
    suggestions.push(...contextSuggestions)

    // Remove duplicates and return top 3
    return [...new Set(suggestions)].slice(0, 3)
  }

  async updateSettings(newSettings: Partial<AISearchSettings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings }
  }

  async getSettings(): Promise<AISearchSettings> {
    return { ...this.settings }
  }

  async clearMemory(): Promise<void> {
    this.searchHistory = []
  }

  async getSearchAnalytics() {
    return {
      totalSearches: this.searchHistory.length,
      topQueries: this.searchHistory.slice(0, 5).map(query => ({ query, count: 1 })),
      averageResultsCount: 8,
      memoryUsage: this.searchHistory.length * 50 // Rough estimate
    }
  }
}

// Export singleton instance
export const offlineAISearch = new OfflineAISearch()

// Export convenience functions
export const aiSearch = (query: string, options?: any) => offlineAISearch.search(query, options)
export const initAISearch = () => offlineAISearch.initialize()
export const updateAISearchSettings = (settings: Partial<AISearchSettings>) => 
  offlineAISearch.updateSettings(settings)
export const getAISearchSettings = () => offlineAISearch.getSettings()
export const clearSearchMemory = () => offlineAISearch.clearMemory()
export const getSearchAnalytics = () => offlineAISearch.getSearchAnalytics()
