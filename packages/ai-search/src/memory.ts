import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { AISearchResult } from './index'

export interface SearchContext {
  previousQueries: string[]
  relatedTopics: string[]
  userPreferences: Record<string, any>
}

export interface SearchMemory {
  id?: string
  query: string
  results: AISearchResult[]
  context: SearchContext
  timestamp: number
}

export interface AISearchSettings {
  memoryRetentionHours: number
  maxContextLength: number
  enableContextMemory: boolean
  enableAISummaries: boolean
  aiModelPath: string
  embeddingModelPath: string
}

export interface SearchAnalytics {
  query: string
  timestamp: number
  resultCount: number
  processingTime: number
  wasAIEnhanced: boolean
}

export class AISearchDB extends Dexie {
  searchMemories!: Table<SearchMemory, string>
  searchSettings!: Table<{ id: string; settings: AISearchSettings }, string>
  searchAnalytics!: Table<SearchAnalytics, string>

  constructor() {
    super('grahmos-ai-search')
    
    this.version(1).stores({
      searchMemories: '++id, query, timestamp',
      searchSettings: 'id',
      searchAnalytics: '++id, query, timestamp, wasAIEnhanced'
    })
  }

  async addSearchMemory(memory: Omit<SearchMemory, 'id'>): Promise<void> {
    try {
      await this.searchMemories.add({
        ...memory,
        id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      })
      
      // Also log analytics
      await this.searchAnalytics.add({
        query: memory.query,
        timestamp: memory.timestamp,
        resultCount: memory.results.length,
        processingTime: 0, // Will be updated by caller
        wasAIEnhanced: memory.results.some(r => r.aiEnhanced)
      })
    } catch (error) {
      console.error('Failed to add search memory:', error)
    }
  }

  async getRecentSearches(limit: number = 10): Promise<SearchMemory[]> {
    try {
      return await this.searchMemories
        .orderBy('timestamp')
        .reverse()
        .limit(limit)
        .toArray()
    } catch (error) {
      console.error('Failed to get recent searches:', error)
      return []
    }
  }

  async getSearchesByQuery(query: string, limit: number = 5): Promise<SearchMemory[]> {
    try {
      return await this.searchMemories
        .where('query')
        .startsWithIgnoreCase(query)
        .reverse()
        .sortBy('timestamp')
        .then(results => results.slice(0, limit))
    } catch (error) {
      console.error('Failed to get searches by query:', error)
      return []
    }
  }

  async cleanupExpiredMemories(expiryTimestamp: number): Promise<number> {
    try {
      const expiredMemories = await this.searchMemories
        .where('timestamp')
        .below(expiryTimestamp)
        .toArray()

      await this.searchMemories
        .where('timestamp')
        .below(expiryTimestamp)
        .delete()

      console.log(`🧹 Cleaned up ${expiredMemories.length} expired search memories`)
      return expiredMemories.length
    } catch (error) {
      console.error('Failed to cleanup expired memories:', error)
      return 0
    }
  }

  async clearAllMemories(): Promise<void> {
    try {
      await this.searchMemories.clear()
      await this.searchAnalytics.clear()
      console.log('🗑️ Cleared all search memories and analytics')
    } catch (error) {
      console.error('Failed to clear all memories:', error)
    }
  }

  async updateSettings(settings: AISearchSettings): Promise<void> {
    try {
      await this.searchSettings.put({
        id: 'current',
        settings
      })
    } catch (error) {
      console.error('Failed to update settings:', error)
    }
  }

  async getSettings(): Promise<AISearchSettings | null> {
    try {
      const result = await this.searchSettings.get('current')
      return result?.settings || null
    } catch (error) {
      console.error('Failed to get settings:', error)
      return null
    }
  }

  async getAnalytics(): Promise<{
    totalSearches: number
    topQueries: Array<{ query: string; count: number }>
    averageResultsCount: number
    memoryUsage: number
  }> {
    try {
      const [memories, analytics] = await Promise.all([
        this.searchMemories.toArray(),
        this.searchAnalytics.toArray()
      ])

      // Calculate top queries
      const queryCount = new Map<string, number>()
      memories.forEach(memory => {
        const normalized = memory.query.toLowerCase().trim()
        queryCount.set(normalized, (queryCount.get(normalized) || 0) + 1)
      })

      const topQueries = Array.from(queryCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([query, count]) => ({ query, count }))

      // Calculate average results count
      const averageResultsCount = memories.length > 0
        ? memories.reduce((sum, memory) => sum + memory.results.length, 0) / memories.length
        : 0

      // Estimate memory usage (rough calculation)
      const memoryUsageBytes = memories.reduce((sum, memory) => {
        return sum + JSON.stringify(memory).length * 2 // rough estimate in bytes
      }, 0)

      return {
        totalSearches: memories.length,
        topQueries,
        averageResultsCount: Math.round(averageResultsCount * 10) / 10,
        memoryUsage: Math.round(memoryUsageBytes / 1024) // KB
      }
    } catch (error) {
      console.error('Failed to get analytics:', error)
      return {
        totalSearches: 0,
        topQueries: [],
        averageResultsCount: 0,
        memoryUsage: 0
      }
    }
  }

  async getSearchTrends(days: number = 7): Promise<Array<{
    date: string
    searchCount: number
    avgResultCount: number
  }>> {
    try {
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000)
      const recentMemories = await this.searchMemories
        .where('timestamp')
        .above(cutoffTime)
        .toArray()

      const dailyStats = new Map<string, { count: number; totalResults: number }>()

      recentMemories.forEach(memory => {
        const date = new Date(memory.timestamp).toISOString().split('T')[0]
        const current = dailyStats.get(date) || { count: 0, totalResults: 0 }
        dailyStats.set(date, {
          count: current.count + 1,
          totalResults: current.totalResults + memory.results.length
        })
      })

      return Array.from(dailyStats.entries()).map(([date, stats]) => ({
        date,
        searchCount: stats.count,
        avgResultCount: Math.round((stats.totalResults / stats.count) * 10) / 10
      })).sort((a, b) => a.date.localeCompare(b.date))
    } catch (error) {
      console.error('Failed to get search trends:', error)
      return []
    }
  }

  async exportSearchData(): Promise<{
    memories: SearchMemory[]
    analytics: SearchAnalytics[]
    settings: AISearchSettings | null
  }> {
    try {
      const [memories, analytics, settingsRecord] = await Promise.all([
        this.searchMemories.toArray(),
        this.searchAnalytics.toArray(),
        this.searchSettings.get('current')
      ])

      return {
        memories,
        analytics,
        settings: settingsRecord?.settings || null
      }
    } catch (error) {
      console.error('Failed to export search data:', error)
      return {
        memories: [],
        analytics: [],
        settings: null
      }
    }
  }

  async importSearchData(data: {
    memories?: SearchMemory[]
    analytics?: SearchAnalytics[]
    settings?: AISearchSettings
  }): Promise<void> {
    try {
      if (data.memories) {
        await this.searchMemories.bulkAdd(data.memories)
      }
      
      if (data.analytics) {
        await this.searchAnalytics.bulkAdd(data.analytics)
      }
      
      if (data.settings) {
        await this.updateSettings(data.settings)
      }

      console.log('✅ Successfully imported search data')
    } catch (error) {
      console.error('Failed to import search data:', error)
      throw error
    }
  }
}
