'use client'
import React, { useState, useEffect } from 'react'
import { getSearchAnalytics } from 'ai-search'

interface SearchAnalyticsProps {
  className?: string
}

export function SearchAnalyticsDashboard({ className = "" }: SearchAnalyticsProps) {
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [storageUsed, setStorageUsed] = useState<number>(0)

  useEffect(() => {
    loadAnalytics()
    loadStorageInfo()
  }, [])

  const loadAnalytics = async () => {
    try {
      const data = await getSearchAnalytics()
      setAnalytics(data)
    } catch (error) {
      console.error('Failed to load analytics:', error)
      // Provide fallback data
      setAnalytics({
        totalSearches: 0,
        topQueries: [],
        averageResultsCount: 0,
        memoryUsage: 0
      })
    }
    setLoading(false)
  }

  const loadStorageInfo = async () => {
    try {
      // Estimate storage usage from browser APIs
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        setStorageUsed(estimate.usage || 0)
      }
    } catch (error) {
      console.warn('Could not get storage estimate:', error)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  if (loading) {
    return (
      <div className={`bg-neutral-900 border border-neutral-800 rounded-xl shadow-lg p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-neutral-700 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-24 bg-neutral-700 rounded"></div>
            <div className="h-24 bg-neutral-700 rounded"></div>
            <div className="h-24 bg-neutral-700 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-neutral-900 border border-neutral-800 rounded-xl shadow-lg ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-neutral-800">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-sm">📊</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-100">
              Search Analytics
            </h2>
            <p className="text-sm text-neutral-400">
              Offline AI search insights and patterns
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {analytics && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-neutral-800 p-4 rounded-lg">
                <div className="text-2xl font-bold text-neutral-100">
                  {analytics.totalSearches}
                </div>
                <div className="text-sm text-neutral-400">Total Searches</div>
              </div>
              <div className="bg-neutral-800 p-4 rounded-lg">
                <div className="text-2xl font-bold text-neutral-100">
                  {analytics.averageResultsCount}
                </div>
                <div className="text-sm text-neutral-400">Avg Results</div>
              </div>
              <div className="bg-neutral-800 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-400">
                  100%
                </div>
                <div className="text-sm text-neutral-400">Offline Mode</div>
              </div>
              <div className="bg-neutral-800 p-4 rounded-lg">
                <div className="text-2xl font-bold text-neutral-100">
                  {formatBytes(storageUsed)}
                </div>
                <div className="text-sm text-neutral-400">Storage Used</div>
              </div>
            </div>

            {/* Top Queries */}
            {analytics.topQueries && analytics.topQueries.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-neutral-100 mb-4">
                  Most Popular Searches
                </h3>
                <div className="space-y-2">
                  {analytics.topQueries.slice(0, 5).map((item: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-neutral-800 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-blue-100">
                            #{index + 1}
                          </span>
                        </div>
                        <span className="text-sm text-neutral-200 truncate">
                          {item.query}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-neutral-400">
                        {item.count} searches
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Offline Notice */}
            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mt-0.5">
                  <span className="text-xs">ℹ️</span>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-blue-300 mb-1">Offline AI Search</h4>
                  <p className="text-sm text-blue-100">
                    All search functionality works completely offline using built-in AI algorithms and emergency knowledge base. 
                    No external models or internet connection required.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
