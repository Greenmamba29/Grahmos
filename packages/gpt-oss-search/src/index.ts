// Browser-compatible GPT-OSS Semantic Search exports
export * from './client'
export * from './types'

// Re-export browser-compatible functions with simplified names for consistency
export {
  initializeGPTOSS as initSemanticSearch,
  semanticSearch,
  analyzeSearchIntent,
  createBrowserSemanticEngine
} from './client'

// Default export for convenience
import { initializeGPTOSS, semanticSearch, analyzeSearchIntent } from './client'

export default {
  initialize: initializeGPTOSS,
  search: semanticSearch,
  analyze: analyzeSearchIntent
}
