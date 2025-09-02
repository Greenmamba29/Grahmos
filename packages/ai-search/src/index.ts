// Clean offline-first AI search implementation
// Import our lightweight offline AI implementation
import {
  aiSearch as offlineAISearch,
  initAISearch as initOfflineAISearch,
  updateAISearchSettings as updateOfflineAISearchSettings,
  getAISearchSettings as getOfflineAISearchSettings,
  clearSearchMemory as clearOfflineSearchMemory,
  getSearchAnalytics as getOfflineSearchAnalytics,
  type AISearchResult,
  type AISearchResponse,
  type SearchContext,
  type AISearchSettings
} from './offline-ai'

// Re-export types for external use
export type {
  AISearchResult,
  AISearchResponse,
  SearchContext,
  AISearchSettings
}

// Re-export functions directly from offline AI
export const aiSearch = offlineAISearch
export const initAISearch = initOfflineAISearch
export const updateAISearchSettings = updateOfflineAISearchSettings
export const getAISearchSettings = getOfflineAISearchSettings
export const clearSearchMemory = clearOfflineSearchMemory
export const getSearchAnalytics = getOfflineSearchAnalytics
