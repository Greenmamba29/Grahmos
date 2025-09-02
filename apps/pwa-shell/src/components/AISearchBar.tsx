'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { aiSearch, initAISearch, getAISearchSettings, updateAISearchSettings } from 'ai-search'
import type { AISearchResponse, AISearchResult, AISearchSettings } from 'ai-search'

interface AISearchBarProps {
  onResults?: (response: AISearchResponse) => void
  placeholder?: string
  className?: string
  showSuggestions?: boolean
  showAISummary?: boolean
  autoFocus?: boolean
}

export function AISearchBar({
  onResults,
  placeholder = "Ask anything... AI will understand your context 🤖",
  className = "",
  showSuggestions = true,
  showAISummary = true,
  autoFocus = false
}: AISearchBarProps) {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<AISearchResponse | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [settings, setSettings] = useState<AISearchSettings | null>(null)
  const [error, setError] = useState<string | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize AI search on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        await initAISearch()
        const currentSettings = await getAISearchSettings()
        setSettings(currentSettings)
        setIsInitialized(true)
      } catch (error) {
        console.error('Failed to initialize AI search:', error)
        setError('AI search initialization failed. Using basic search.')
      }
    }
    initialize()
  }, [])

  // Auto-focus if requested
  useEffect(() => {
    if (autoFocus && searchInputRef.current && isInitialized) {
      searchInputRef.current.focus()
    }
  }, [autoFocus, isInitialized])

  // Debounced search function
  const debouncedSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() || !isInitialized) return

      setIsSearching(true)
      setError(null)

      try {
        const response = await aiSearch(searchQuery, {
          includeAISummary: showAISummary,
          useMemoryContext: settings?.enableContextMemory
        })

        setResults(response)
        if (onResults) {
          onResults(response)
        }

        // Update suggestions with AI-generated queries
        if (response.suggestedQueries.length > 0) {
          setSuggestions(response.suggestedQueries)
        }
      } catch (error) {
        console.error('Search failed:', error)
        setError('Search failed. Please try again.')
      } finally {
        setIsSearching(false)
      }
    },
    [isInitialized, showAISummary, settings, onResults]
  )

  // Handle input changes with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set new timer for search
    if (newQuery.trim()) {
      debounceTimerRef.current = setTimeout(() => {
        debouncedSearch(newQuery)
      }, 500) // 500ms debounce
      setShowDropdown(true)
    } else {
      setShowDropdown(false)
      setResults(null)
      setSuggestions([])
    }
  }

  // Handle suggestion clicks
  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion)
    setShowDropdown(false)
    debouncedSearch(suggestion)
    searchInputRef.current?.focus()
  }

  // Handle key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowDropdown(false)
    } else if (e.key === 'Enter' && query.trim()) {
      e.preventDefault()
      setShowDropdown(false)
      debouncedSearch(query)
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !searchInputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const formatProcessingTime = (time: number) => {
    if (time < 1000) return `${time}ms`
    return `${(time / 1000).toFixed(1)}s`
  }

  return (
    <div className={`relative w-full max-w-2xl mx-auto ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg
            className={`h-5 w-5 transition-colors ${
              isSearching 
                ? 'text-blue-500 animate-pulse' 
                : isInitialized 
                  ? 'text-gray-400 dark:text-gray-500' 
                  : 'text-red-400'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isSearching ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            )}
          </svg>
        </div>
        
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim() && setShowDropdown(true)}
          placeholder={placeholder}
          disabled={!isInitialized}
          className={`
            block w-full pl-12 pr-16 py-4 
            border-0 bg-neutral-800/50 backdrop-blur-sm
            rounded-2xl shadow-lg
            placeholder-neutral-400
            focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-neutral-700/50
            text-white text-lg
            transition-all duration-300
            ${!isInitialized ? 'opacity-50 cursor-not-allowed' : ''}
            ${error ? 'ring-2 ring-red-500/50 bg-red-900/10' : ''}
          `}
        />

        {/* AI Status Indicator */}
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <div className="flex items-center space-x-2">
            {isInitialized && (
              <span className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                AI
              </span>
            )}
            {settings?.enableContextMemory && (
              <span className="text-xs text-blue-600 dark:text-blue-400">
                🧠
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Dropdown with Results and Suggestions */}
      {showDropdown && (showSuggestions || results) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-96 overflow-y-auto"
        >
          {/* AI Summary */}
          {results?.aiSummary && showAISummary && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start space-x-2">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <span className="text-xs">🤖</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {results.aiSummary}
                  </p>
                  <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400 space-x-4">
                    <span>
                      {results.results.length} result{results.results.length !== 1 ? 's' : ''}
                    </span>
                    <span>
                      {formatProcessingTime(results.processingTime)}
                    </span>
                    {results.searchContext.previousQueries.length > 0 && (
                      <span className="flex items-center">
                        🧠 Context aware
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search Results */}
          {results?.results && results.results.length > 0 && (
            <div className="p-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 px-2 py-1">
                Search Results
              </h3>
              {results.results.slice(0, 5).map((result) => (
                <SearchResultItem key={result.id} result={result} />
              ))}
            </div>
          )}

          {/* Suggested Queries */}
          {suggestions.length > 0 && showSuggestions && (
            <div className="p-2 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 px-2 py-1">
                AI Suggestions
              </h3>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>{suggestion}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {results && results.results.length === 0 && (
            <div className="p-4 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No results found for "{query}"
              </p>
              {suggestions.length > 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Try one of the AI suggestions below
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Search Result Item Component
function SearchResultItem({ result }: { result: AISearchResult }) {
  const handleClick = () => {
    if (result.url) {
      window.open(result.url, '_blank')
    }
  }

  return (
    <button
      onClick={handleClick}
      className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors group"
    >
      <div className="flex items-start space-x-3">
        {result.aiEnhanced && (
          <div className="flex-shrink-0 w-5 h-5 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <span className="text-xs">✨</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {result.title}
          </h4>
          {result.aiSummary && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 line-clamp-2">
              🤖 {result.aiSummary}
            </p>
          )}
          {result.summary && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
              {result.summary}
            </p>
          )}
          <div className="flex items-center mt-2 space-x-3">
            {result.category && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                {result.category}
              </span>
            )}
            {result.contextRelevance !== undefined && (
              <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                <span className="mr-1">🎯</span>
                <span>{Math.round(result.contextRelevance * 100)}% match</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
