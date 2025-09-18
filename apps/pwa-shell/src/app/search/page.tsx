'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { 
  MagnifyingGlassIcon,
  SparklesIcon,
  BoltIcon,
  DocumentMagnifyingGlassIcon,
  CpuChipIcon,
  WifiIcon,
  ExclamationTriangleIcon,
  Cog6ToothIcon,
  ClockIcon,
  LightBulbIcon,
  SignalIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  ArrowRightIcon,
  BeakerIcon,
  ChatBubbleBottomCenterTextIcon,
  BookOpenIcon,
  FireIcon
} from '@heroicons/react/24/outline'

// GPT-OSS imports
import { initializeGPTOSS, semanticSearch, analyzeSearchIntent } from 'gpt-oss-search'

interface SearchResult {
  id: string
  title: string
  summary?: string
  content?: string
  category?: string
  priority?: 'low' | 'medium' | 'high'
  semantic_score?: number
  processing_time?: number
}

interface SearchResponse {
  results: SearchResult[]
  semantic_summary?: string
  total_processing_time: number
  cache_hit: boolean
}

interface SearchSuggestion {
  id: string
  text: string
  type: 'query' | 'semantic' | 'completion'
  confidence: number
  category?: string
  icon?: string
}

interface LiveSemanticResponse {
  suggestions: SearchSuggestion[]
  intent: string
  context: string[]
  urgency?: 'low' | 'medium' | 'high' | 'critical'
}

export default function SearchPageFixed() {
  const [searchMode, setSearchMode] = useState<'semantic' | 'standard'>('semantic')
  const [isOnline, setIsOnline] = useState(true)
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [reasoningEffort, setReasoningEffort] = useState<'low' | 'medium' | 'high'>('medium')
  const [emergencyMode, setEmergencyMode] = useState(false)
  const [emergencyUrgency, setEmergencyUrgency] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  
  // Live semantic search state
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [semanticIntent, setSemanticIntent] = useState('')
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  
  // Refs for input handling
  const searchInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    setIsOnline(navigator.onLine)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Initialize semantic search
  useEffect(() => {
    if (searchMode === 'semantic') {
      initializeGPTOSS({
        model_size: 'gpt-oss-20b',
        enable_streaming: true,
        max_context_length: emergencyMode ? 2048 : 4096
      })
    }
  }, [searchMode, emergencyMode])

  // Helper function to generate semantic suggestions
  const generateSemanticSuggestions = async (query: string, options: {
    emergencyMode: boolean
    urgency: string
    context: string
  }): Promise<SearchSuggestion[]> => {
    // Simulate GPT-OSS semantic analysis
    const suggestions: SearchSuggestion[] = []
    
    // Query completion suggestions
    if (query.toLowerCase().includes('earthquake')) {
      suggestions.push(
        {
          id: 'eq1',
          text: 'earthquake safety procedures',
          type: 'completion',
          confidence: 0.95,
          category: 'safety',
          icon: 'fire'
        },
        {
          id: 'eq2',
          text: 'earthquake emergency kit checklist',
          type: 'completion',
          confidence: 0.88,
          category: 'preparedness',
          icon: 'beaker'
        }
      )
    }
    
    if (query.toLowerCase().includes('fire')) {
      suggestions.push(
        {
          id: 'fire1',
          text: 'fire evacuation plan',
          type: 'completion',
          confidence: 0.92,
          category: 'safety',
          icon: 'fire'
        },
        {
          id: 'fire2',
          text: 'fire extinguisher types and usage',
          type: 'semantic',
          confidence: 0.85,
          category: 'equipment',
          icon: 'beaker'
        }
      )
    }
    
    if (query.toLowerCase().includes('first aid')) {
      suggestions.push(
        {
          id: 'aid1',
          text: 'basic first aid techniques',
          type: 'completion',
          confidence: 0.94,
          category: 'medical',
          icon: 'beaker'
        },
        {
          id: 'aid2',
          text: 'first aid kit essentials',
          type: 'semantic',
          confidence: 0.87,
          category: 'supplies',
          icon: 'book'
        }
      )
    }
    
    // Emergency context suggestions
    if (options.emergencyMode) {
      suggestions.push({
        id: 'emergency',
        text: `${query} - immediate emergency response`,
        type: 'semantic',
        confidence: 0.98,
        category: 'emergency',
        icon: 'exclamation'
      })
    }
    
    return suggestions
  }

  // Generate basic fallback suggestions
  const generateBasicSuggestions = (query: string): SearchSuggestion[] => {
    const commonTerms = ['safety', 'emergency', 'preparedness', 'first aid', 'evacuation']
    return commonTerms
      .filter(term => term.includes(query.toLowerCase()) || query.toLowerCase().includes(term))
      .map((term, index) => ({
        id: `basic-${index}`,
        text: term,
        type: 'query' as const,
        confidence: 0.5,
        category: 'general'
      }))
  }

  // Live semantic search handler
  const handleLiveSearch = async (searchQuery: string) => {
    if (!searchQuery.trim() || searchMode !== 'semantic') {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    
    setIsAnalyzing(true)
    
    try {
      // Analyze search intent
      const intentPrompt = `Analyze the search intent for: "${searchQuery}". ${emergencyMode ? 'This is an emergency situation.' : ''}`
      setSemanticIntent(intentPrompt)
      
      // Generate semantic suggestions based on query
      const semanticSuggestions = await generateSemanticSuggestions(searchQuery, {
        emergencyMode,
        urgency: emergencyUrgency,
        context: 'live_search'
      })
      
      setSuggestions(semanticSuggestions)
      setShowSuggestions(true)
      
    } catch (error) {
      console.warn('Live semantic search error:', error)
      // Fallback to basic suggestions
      setSuggestions(generateBasicSuggestions(searchQuery))
      setShowSuggestions(true)
    } finally {
      setIsAnalyzing(false)
    }
  }
  
  // Handle query changes with debounced live search
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)
    setSelectedSuggestionIndex(-1)
    
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    // Debounce live search
    debounceRef.current = setTimeout(() => {
      handleLiveSearch(newQuery)
    }, 300)
  }

  // Handle suggestion selection
  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text)
    setShowSuggestions(false)
    // Add to search history
    setSearchHistory(prev => [suggestion.text, ...prev.filter(h => h !== suggestion.text)].slice(0, 10))
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return
    
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1)
    } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
      e.preventDefault()
      handleSuggestionClick(suggestions[selectedSuggestionIndex])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setSelectedSuggestionIndex(-1)
    }
  }

  // Get suggestion icon component
  const getSuggestionIcon = (icon?: string) => {
    switch (icon) {
      case 'fire': return <FireIcon className="h-4 w-4" />
      case 'beaker': return <BeakerIcon className="h-4 w-4" />
      case 'book': return <BookOpenIcon className="h-4 w-4" />
      case 'chat': return <ChatBubbleBottomCenterTextIcon className="h-4 w-4" />
      case 'exclamation': return <ExclamationTriangleIcon className="h-4 w-4" />
      default: return <SparklesIcon className="h-4 w-4" />
    }
  }

  // Get suggestion type color
  const getSuggestionTypeColor = (type: string) => {
    switch (type) {
      case 'completion': return 'text-blue-600 dark:text-blue-400'
      case 'semantic': return 'text-purple-600 dark:text-purple-400'
      case 'query': return 'text-green-600 dark:text-green-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || isSearching) return

    setIsSearching(true)
    
    try {
      // Simulate search - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const mockResults: SearchResponse = {
        results: [
          {
            id: '1',
            title: 'Emergency Preparedness Guide',
            summary: 'Comprehensive guide for emergency preparedness including evacuation procedures, supply checklists, and communication plans.',
            category: 'preparedness',
            priority: 'high',
            semantic_score: 0.95,
            processing_time: 120
          },
          {
            id: '2', 
            title: 'First Aid Basics',
            summary: 'Essential first aid techniques for common emergency situations.',
            category: 'medical',
            priority: 'high',
            semantic_score: 0.87,
            processing_time: 95
          },
          {
            id: '3',
            title: 'Home Fire Safety',
            summary: 'Fire prevention and response procedures for residential properties.',
            category: 'fire-safety',
            priority: 'medium',
            semantic_score: 0.72,
            processing_time: 80
          }
        ],
        semantic_summary: searchMode === 'semantic' 
          ? `Found 3 highly relevant emergency resources for "${query}". All results include actionable procedures with high-priority safety information.`
          : `Found 3 results matching "${query}".`,
        total_processing_time: 450,
        cache_hit: false
      }

      setResults(mockResults)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const formatProcessingTime = (time: number) => {
    return time < 1000 ? `${time}ms` : `${(time / 1000).toFixed(1)}s`
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
      case 'low': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
      default: return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400'
    }
  }

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'medical': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
      case 'fire-safety': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
      case 'preparedness': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
      default: return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Fixed Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Title */}
            <div className="flex items-center gap-3">
              <DocumentMagnifyingGlassIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Grahmos Search
              </h1>
            </div>
            
            {/* Controls */}
            <div className="flex items-center gap-4">
              {/* Network Status */}
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                isOnline 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              }`}>
                <WifiIcon className="h-4 w-4" />
                <span>{isOnline ? 'Online' : 'Offline'}</span>
              </div>

              {/* Search Mode Toggle */}
              <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setSearchMode('semantic')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    searchMode === 'semantic'
                      ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-purple-600'
                  }`}
                >
                  <SparklesIcon className="h-4 w-4" />
                  <CpuChipIcon className="h-4 w-4" />
                  <span>Semantic</span>
                </button>
                
                <button
                  onClick={() => setSearchMode('standard')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    searchMode === 'standard'
                      ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-blue-600'
                  }`}
                >
                  <MagnifyingGlassIcon className="h-4 w-4" />
                  <BoltIcon className="h-4 w-4" />
                  <span>Standard</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Mode Description */}
        <div className="mb-8">
          {searchMode === 'semantic' ? (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 
                           p-6 rounded-xl border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-3 mb-3">
                <SparklesIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                <CpuChipIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Semantic Search Mode
                </h2>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-3">
                AI-powered search with natural language understanding, emergency context awareness, and real-time reasoning.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 
                               rounded-full text-sm font-medium">
                  Natural Language
                </span>
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 
                               rounded-full text-sm font-medium">
                  Context Aware
                </span>
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 
                               rounded-full text-sm font-medium">
                  Emergency Ready
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-blue-50 to-gray-50 dark:from-blue-900/20 dark:to-gray-900/20 
                           p-6 rounded-xl border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3 mb-3">
                <MagnifyingGlassIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <BoltIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Standard Search Mode
                </h2>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-3">
                Fast keyword-based search with offline capability. Perfect for quick lookups and specific terms.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 
                               rounded-full text-sm font-medium">
                  Keyword Matching
                </span>
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 
                               rounded-full text-sm font-medium">
                  Offline Ready
                </span>
                <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 
                               rounded-full text-sm font-medium">
                  Fast Results
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Search Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Search Area */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              {/* Search Header */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  {searchMode === 'semantic' ? (
                    <>
                      <SparklesIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                      <CpuChipIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </>
                  ) : (
                    <>
                      <MagnifyingGlassIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                      <BoltIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                    </>
                  )}
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {searchMode === 'semantic' ? 'Semantic Search Console' : 'Standard Search'}
                  </h2>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  {searchMode === 'semantic' 
                    ? 'Ask questions in natural language about emergency procedures and safety'
                    : 'Search using keywords for quick results'
                  }
                </p>
              </div>

              {/* Search Form */}
              <div className="relative mb-8">
                <form onSubmit={handleSearch}>
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    {isAnalyzing && searchMode === 'semantic' ? (
                      <CpuChipIcon className="h-5 w-5 text-purple-500 animate-pulse" />
                    ) : (
                      <MagnifyingGlassIcon className={`h-5 w-5 ${
                        isSearching ? 'text-blue-500 animate-pulse' : 'text-gray-400 dark:text-gray-500'
                      }`} />
                    )}
                  </div>
                  
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={handleQueryChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => query.trim() && setShowSuggestions(true)}
                    onBlur={() => {
                      // Delay hiding suggestions to allow for click events
                      setTimeout(() => setShowSuggestions(false), 200)
                    }}
                    placeholder={searchMode === 'semantic' 
                      ? "Ask about emergency procedures, safety guidelines..."
                      : "Search for emergency information..."
                    }
                    className="w-full pl-12 pr-32 py-4 text-lg border-2 border-gray-200 dark:border-gray-700 rounded-xl 
                             bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                             focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 
                             transition-all duration-200 shadow-sm hover:shadow-md"
                    disabled={isSearching}
                    autoComplete="off"
                  />
                  
                  <button
                    type="submit"
                    disabled={isSearching || !query.trim()}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  >
                    <div className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                      isSearching || !query.trim() 
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-sm hover:shadow-md'
                    }`}>
                      {isSearching ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Searching...
                        </div>
                      ) : (
                        'Search'
                      )}
                    </div>
                  </button>
                </form>

                {/* Search Options */}
                {searchMode === 'semantic' && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={emergencyMode}
                            onChange={(e) => setEmergencyMode(e.target.checked)}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                          <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Emergency Mode
                          </span>
                        </label>

                        {emergencyMode && (
                          <select
                            value={emergencyUrgency}
                            onChange={(e) => setEmergencyUrgency(e.target.value as any)}
                            className="text-sm px-3 py-1 rounded border border-gray-300 dark:border-gray-600 
                                     bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 
                                 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                      >
                        <Cog6ToothIcon className="h-4 w-4" />
                        <span>Advanced</span>
                        {showAdvancedSettings ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Advanced Settings */}
                    {showAdvancedSettings && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Reasoning Effort
                            </label>
                            <select
                              value={reasoningEffort}
                              onChange={(e) => setReasoningEffort(e.target.value as any)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md
                                       bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            >
                              <option value="low">Low (Fast)</option>
                              <option value="medium">Medium (Balanced)</option>
                              <option value="high">High (Thorough)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Live Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div 
                  ref={suggestionsRef}
                  className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                           rounded-xl shadow-xl max-h-96 overflow-y-auto"
                >
                  {/* Analysis Status */}
                  {isAnalyzing && (
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-3 text-purple-600 dark:text-purple-400">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <CpuChipIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">Analyzing semantic intent...</span>
                      </div>
                    </div>
                  )}

                  {/* Semantic Intent */}
                  {semanticIntent && (
                    <div className="p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 
                                   border-b border-purple-100 dark:border-purple-800">
                      <div className="flex items-start gap-2">
                        <SparklesIcon className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">Intent Analysis</p>
                          <p className="text-sm text-purple-600 dark:text-purple-400">{semanticIntent}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Suggestions List */}
                  <div className="py-2">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={suggestion.id}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 
                                  transition-colors border-l-4 ${
                          index === selectedSuggestionIndex 
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-l-blue-500' 
                            : 'border-l-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex-shrink-0 ${getSuggestionTypeColor(suggestion.type)}`}>
                            {getSuggestionIcon(suggestion.icon)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-gray-900 dark:text-gray-100 font-medium truncate">
                                {suggestion.text}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${getSuggestionTypeColor(suggestion.type)}`}>
                                {suggestion.type}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                              {suggestion.category && (
                                <span className="capitalize">{suggestion.category}</span>
                              )}
                              <div className="flex items-center gap-1">
                                <span>Confidence:</span>
                                <div className="flex items-center gap-1">
                                  <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-green-500 transition-all duration-300"
                                      style={{ width: `${suggestion.confidence * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-green-600 dark:text-green-400 font-medium">
                                    {Math.round(suggestion.confidence * 100)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <ArrowRightIcon className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Emergency Mode Indicator */}
                  {emergencyMode && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border-t border-red-100 dark:border-red-800">
                      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                        <ExclamationTriangleIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Emergency Mode Active - {emergencyUrgency.toUpperCase()} Priority
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Results Section */}
              {results && (
                <div className="space-y-6">
                  {/* Summary */}
                  {results.semantic_summary && (
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 
                                   p-6 rounded-xl border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                          Search Summary
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <ClockIcon className="h-4 w-4" />
                          <span>{formatProcessingTime(results.total_processing_time)}</span>
                          {results.cache_hit && (
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 
                                           rounded-full text-xs">
                              Cached
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-gray-700 dark:text-gray-300">
                        {results.semantic_summary}
                      </p>
                    </div>
                  )}

                  {/* Results List */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Results ({results.results.length})
                    </h3>
                    
                    {results.results.map((result) => (
                      <div key={result.id} 
                           className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 
                                    hover:shadow-md transition-all duration-200">
                        
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                            {result.title}
                          </h4>
                          <div className="flex items-center gap-2">
                            {result.priority && (
                              <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${getPriorityColor(result.priority)}`}>
                                {result.priority} Priority
                              </span>
                            )}
                            {searchMode === 'semantic' && result.semantic_score && (
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                Score: {(result.semantic_score * 100).toFixed(0)}%
                              </div>
                            )}
                          </div>
                        </div>

                        {result.summary && (
                          <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                            {result.summary}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-4">
                            {result.category && (
                              <span className={`px-2 py-1 rounded-full text-xs ${getCategoryColor(result.category)}`}>
                                {result.category.replace('-', ' ')}
                              </span>
                            )}
                            {result.processing_time && (
                              <span>Processing: {formatProcessingTime(result.processing_time)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!results && !isSearching && (
                <div className="text-center py-12">
                  <div className="mb-6">
                    {searchMode === 'semantic' ? (
                      <div className="flex justify-center gap-2 mb-4">
                        <SparklesIcon className="h-16 w-16 text-purple-300 dark:text-purple-600" />
                        <CpuChipIcon className="h-16 w-16 text-blue-300 dark:text-blue-600" />
                      </div>
                    ) : (
                      <MagnifyingGlassIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    )}
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Ready to search
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {searchMode === 'semantic' 
                      ? 'Ask questions about emergency preparedness, safety procedures, or any information you need.'
                      : 'Enter keywords to find relevant emergency information quickly.'
                    }
                  </p>
                  
                  {/* Quick Examples */}
                  <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
                    {[
                      'earthquake safety',
                      'first aid basics', 
                      'fire evacuation',
                      'emergency supplies',
                      'power outage prep'
                    ].map(example => (
                      <button
                        key={example}
                        onClick={() => setQuery(example)}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 
                                 text-gray-700 dark:text-gray-300 rounded-full transition-colors text-sm"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Live Search Analytics (Semantic Mode Only) */}
            {searchMode === 'semantic' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  <div className="flex items-center gap-2">
                    <CpuChipIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    Live Analytics
                  </div>
                </h3>
                
                <div className="space-y-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Suggestions</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      suggestions.length > 0 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400'
                    }`}>
                      {suggestions.length} active
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Analysis</span>
                    <span className={isAnalyzing 
                      ? 'text-purple-600 dark:text-purple-400 animate-pulse' 
                      : 'text-gray-500 dark:text-gray-500'
                    }>
                      {isAnalyzing ? 'Processing...' : 'Ready'}
                    </span>
                  </div>
                  
                  {semanticIntent && (
                    <div>
                      <p className="text-gray-600 dark:text-gray-400 mb-2">Current Intent</p>
                      <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
                        <p className="text-purple-700 dark:text-purple-300 text-xs leading-relaxed">
                          {semanticIntent}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Search History */}
            {searchHistory.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  <div className="flex items-center gap-2">
                    <ClockIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Recent Searches
                  </div>
                </h3>
                
                <div className="space-y-2">
                  {searchHistory.slice(0, 5).map((historyQuery, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setQuery(historyQuery)
                        setShowSuggestions(false)
                      }}
                      className="w-full text-left p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 
                               transition-colors text-sm text-gray-700 dark:text-gray-300 truncate"
                      title={historyQuery}
                    >
                      <div className="flex items-center gap-2">
                        <ClockIcon className="h-3 w-3 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{historyQuery}</span>
                      </div>
                    </button>
                  ))}
                  
                  {searchHistory.length > 5 && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 text-center pt-2">
                      +{searchHistory.length - 5} more searches
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Search Tips */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Search Tips
              </h3>
              
              <div className="space-y-4 text-sm">
                {searchMode === 'semantic' ? (
                  <>
                    <div>
                      <p className="font-medium text-purple-600 dark:text-purple-400 mb-1">
                        <SparklesIcon className="h-4 w-4 inline mr-1" />
                        Natural Language
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">
                        "What should I do during an earthquake?"
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-blue-600 dark:text-blue-400 mb-1">
                        <CpuChipIcon className="h-4 w-4 inline mr-1" />
                        Context Aware
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">
                        Ask follow-up questions for detailed guidance
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-red-600 dark:text-red-400 mb-1">
                        <ExclamationTriangleIcon className="h-4 w-4 inline mr-1" />
                        Emergency Mode
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">
                        Enable for urgent situations with priority results
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="font-medium text-blue-600 dark:text-blue-400 mb-1">
                        <MagnifyingGlassIcon className="h-4 w-4 inline mr-1" />
                        Keywords
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">
                        "earthquake safety checklist"
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-green-600 dark:text-green-400 mb-1">
                        <BoltIcon className="h-4 w-4 inline mr-1" />
                        Fast Results
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">
                        Works offline with instant responses
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Status
              </h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Connection</span>
                  <span className={isOnline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Search Mode</span>
                  <span className={searchMode === 'semantic' ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}>
                    {searchMode === 'semantic' ? 'Semantic' : 'Standard'}
                  </span>
                </div>
                {emergencyMode && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Emergency</span>
                    <span className="text-red-600 dark:text-red-400 capitalize">
                      {emergencyUrgency}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}