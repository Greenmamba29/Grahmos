'use client'
import React, { useState, useEffect } from 'react'
import { AISearchBar } from '../../components/AISearchBar'
import { AISearchSettings } from '../../components/AISearchSettings'
import { SearchAnalyticsDashboard } from '../../components/SearchAnalyticsDashboard'
import type { AISearchResponse } from 'ai-search'

export default function AISearchPage() {
  const [searchResults, setSearchResults] = useState<AISearchResponse | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    // Check for dark mode preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDarkMode(mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const handleSearchResults = (results: AISearchResponse) => {
    setSearchResults(results)
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      isDarkMode ? 'dark bg-gray-900' : 'bg-gradient-to-br from-blue-50 via-white to-indigo-50'
    }`}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">🤖</span>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Grahmos AI Search
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Experience the future of search with our intelligent AI assistant. 
            Context-aware, offline-capable, and privacy-focused.
          </p>
          <div className="flex items-center justify-center mt-4 space-x-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              Offline Ready
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
              🧠 Context Aware
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
              ✨ AI Enhanced
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="max-w-4xl mx-auto mb-8">
          <AISearchBar 
            onResults={handleSearchResults}
            autoFocus={true}
            className="mb-4"
          />
          
          {/* Quick Actions */}
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              AI Settings
            </button>
            
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {isDarkMode ? (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Light Mode
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  Dark Mode
                </>
              )}
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="max-w-4xl mx-auto mb-8">
            <AISearchSettings 
              onClose={() => setShowSettings(false)}
            />
          </div>
        )}

        {/* Search Results Display */}
        {searchResults && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Search Results
                </h2>
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-4">
                  <span>{searchResults.results.length} results</span>
                  <span>{searchResults.processingTime < 1000 
                    ? `${searchResults.processingTime}ms` 
                    : `${(searchResults.processingTime / 1000).toFixed(1)}s`}</span>
                </div>
              </div>

              {/* AI Summary */}
              {searchResults.aiSummary && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg mb-6 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <span className="text-sm">🤖</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                        AI Summary
                      </h3>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        {searchResults.aiSummary}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Results List */}
              <div className="space-y-4">
                {searchResults.results.map((result) => (
                  <div key={result.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => result.url && window.open(result.url, '_blank')}>
                    <div className="flex items-start space-x-3">
                      {result.aiEnhanced && (
                        <div className="flex-shrink-0 w-6 h-6 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                          <span className="text-xs">✨</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400">
                          {result.title}
                        </h3>
                        
                        {result.aiSummary && (
                          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              <span className="font-medium">🤖 AI Summary:</span> {result.aiSummary}
                            </p>
                          </div>
                        )}
                        
                        {result.summary && (
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            {result.summary}
                          </p>
                        )}
                        
                        <div className="flex items-center mt-3 space-x-4">
                          {result.category && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                              {result.category}
                            </span>
                          )}
                          {result.contextRelevance !== undefined && (
                            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                              <span className="mr-1">🎯</span>
                              <span>{Math.round(result.contextRelevance * 100)}% match</span>
                            </div>
                          )}
                          {result.priority && (
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              result.priority === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' :
                              result.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200' :
                              'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                            }`}>
                              {result.priority} priority
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Suggested Queries */}
              {searchResults.suggestedQueries.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    AI Suggested Searches
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {searchResults.suggestedQueries.map((query, index) => (
                      <button
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        onClick={() => {
                          // This would trigger a new search with the suggested query
                          console.log('Suggested query clicked:', query)
                        }}
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {query}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Demo Features */}
        {!searchResults && (
          <div className="max-w-4xl mx-auto mt-12">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Intelligent Search Features
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Try searching to experience these AI-powered capabilities
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-xl">🧠</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Context Memory
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Remembers your previous searches to provide more relevant and personalized results over time.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-xl">📱</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Offline Capable
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Works completely offline with locally cached AI models. No internet connection required.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-xl">✨</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  AI Summaries
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Automatically generates intelligent summaries and suggestions based on your search intent.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Dashboard */}
        <div className="max-w-6xl mx-auto mt-12">
          <SearchAnalyticsDashboard />
        </div>
      </div>
    </div>
  )
}
