'use client'
import React, { useState, useEffect } from 'react'
import { getSearchAnalytics } from 'ai-search'
import { modelManager } from 'ai-search/src/model-manager'
import type { ModelInfo, ModelDownloadProgress } from 'ai-search/src/model-manager'

interface SearchAnalyticsProps {
  className?: string
}

export function SearchAnalyticsDashboard({ className = "" }: SearchAnalyticsProps) {
  const [analytics, setAnalytics] = useState<any>(null)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [storageInfo, setStorageInfo] = useState<any>(null)
  const [downloadingModels, setDownloadingModels] = useState<Map<string, ModelDownloadProgress>>(new Map())
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'models' | 'storage'>('overview')

  useEffect(() => {
    loadData()
    
    // Listen for model download progress
    const unsubscribe = modelManager.onDownloadProgress((progress) => {
      setDownloadingModels(prev => {
        const newMap = new Map(prev)
        if (progress.status === 'complete' || progress.status === 'error') {
          newMap.delete(progress.modelId)
        } else {
          newMap.set(progress.modelId, progress)
        }
        return newMap
      })
      
      // Refresh model data when download completes
      if (progress.status === 'complete') {
        setTimeout(loadModelData, 1000)
      }
    })

    return unsubscribe
  }, [])

  const loadData = async () => {
    setLoading(true)
    await Promise.all([
      loadAnalytics(),
      loadModelData(),
      loadStorageInfo()
    ])
    setLoading(false)
  }

  const loadAnalytics = async () => {
    try {
      const data = await getSearchAnalytics()
      setAnalytics(data)
    } catch (error) {
      console.error('Failed to load analytics:', error)
    }
  }

  const loadModelData = async () => {
    try {
      const availableModels = await modelManager.getAvailableModels()
      setModels(availableModels)
    } catch (error) {
      console.error('Failed to load models:', error)
    }
  }

  const loadStorageInfo = async () => {
    try {
      const info = await modelManager.getStorageInfo()
      setStorageInfo(info)
    } catch (error) {
      console.error('Failed to load storage info:', error)
    }
  }

  const handleDownloadModel = async (modelId: string) => {
    try {
      await modelManager.downloadModel(modelId)
      await loadModelData()
    } catch (error) {
      console.error('Failed to download model:', error)
      alert('Failed to download model. Please try again.')
    }
  }

  const handleDeleteModel = async (modelId: string) => {
    if (!confirm('Are you sure you want to delete this model? It will need to be re-downloaded.')) {
      return
    }
    
    try {
      await modelManager.deleteModel(modelId)
      await loadModelData()
      await loadStorageInfo()
    } catch (error) {
      console.error('Failed to delete model:', error)
      alert('Failed to delete model. Please try again.')
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
            <span className="text-sm">📊</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              AI Search Analytics
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Insights into your search patterns and AI model usage
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'models', label: 'AI Models' },
          { key: 'storage', label: 'Storage' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'overview' && analytics && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {analytics.totalSearches}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Searches</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {analytics.averageResultsCount}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Avg Results</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {models.filter(m => m.downloaded).length}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">AI Models</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {storageInfo ? formatBytes(storageInfo.usedSize) : '0 MB'}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Storage Used</div>
              </div>
            </div>

            {/* Top Queries */}
            {analytics.topQueries.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                  Most Popular Searches
                </h3>
                <div className="space-y-2">
                  {analytics.topQueries.slice(0, 8).map((item: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                            #{index + 1}
                          </span>
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                          {item.query}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        {item.count} searches
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'models' && (
          <div className="space-y-6">
            {/* Model Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="text-lg font-semibold text-green-800 dark:text-green-200">
                  {models.filter(m => m.downloaded).length}
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">Downloaded</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="text-lg font-semibold text-orange-800 dark:text-orange-200">
                  {downloadingModels.size}
                </div>
                <div className="text-sm text-orange-600 dark:text-orange-400">Downloading</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  {models.filter(m => !m.downloaded).length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Available</div>
              </div>
            </div>

            {/* Models List */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Available AI Models
              </h3>
              <div className="space-y-4">
                {models.map(model => {
                  const downloadProgress = downloadingModels.get(model.id)
                  const isDownloading = !!downloadProgress
                  
                  return (
                    <div key={model.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              model.type === 'text-generation' 
                                ? 'bg-blue-100 dark:bg-blue-900/30' 
                                : 'bg-purple-100 dark:bg-purple-900/30'
                            }`}>
                              <span className="text-sm">
                                {model.type === 'text-generation' ? '✍️' : '🧠'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                {model.name}
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {model.description}
                              </p>
                              <div className="flex items-center mt-2 space-x-4">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  Size: {model.size} MB
                                </span>
                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                  model.type === 'text-generation'
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                                    : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200'
                                }`}>
                                  {model.type === 'text-generation' ? 'Text Generation' : 'Embeddings'}
                                </span>
                                {model.downloaded && (
                                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                                    Downloaded
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Download Progress */}
                          {isDownloading && downloadProgress && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                                <span>Downloading...</span>
                                <span>{downloadProgress.progress}%</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                  style={{ width: `${downloadProgress.progress}%` }}
                                ></div>
                              </div>
                              {downloadProgress.error && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                  {downloadProgress.error}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Action Button */}
                        <div className="ml-4">
                          {model.downloaded ? (
                            <button
                              onClick={() => handleDeleteModel(model.id)}
                              className="px-3 py-2 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              Delete
                            </button>
                          ) : isDownloading ? (
                            <button
                              disabled
                              className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-not-allowed"
                            >
                              Downloading...
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDownloadModel(model.id)}
                              className="px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            >
                              Download
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'storage' && storageInfo && (
          <div className="space-y-6">
            {/* Storage Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {formatBytes(storageInfo.usedSize)}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Used Storage</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {formatBytes(storageInfo.availableSize)}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Available</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {storageInfo.modelCount}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Models Downloaded</div>
              </div>
            </div>

            {/* Storage Usage Chart */}
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Storage Usage
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span>AI Models</span>
                    <span>{formatBytes(storageInfo.usedSize)}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                    <div 
                      className="bg-blue-600 h-3 rounded-full" 
                      style={{ 
                        width: `${Math.min(100, (storageInfo.usedSize / (storageInfo.usedSize + storageInfo.availableSize)) * 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
                
                {/* Individual Model Breakdown */}
                {models.filter(m => m.downloaded).map(model => {
                  const modelSizeBytes = model.size * 1024 * 1024
                  const percentage = storageInfo.usedSize > 0 ? (modelSizeBytes / storageInfo.usedSize) * 100 : 0
                  
                  return (
                    <div key={model.id} className="flex items-center justify-between py-2 border-t border-gray-200 dark:border-gray-600">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${
                          model.type === 'text-generation' ? 'bg-blue-500' : 'bg-purple-500'
                        }`}></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {model.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {formatBytes(modelSizeBytes)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-500">
                          {percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Storage Actions */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-sm font-medium text-red-700 dark:text-red-400 mb-3">
                Storage Management
              </h3>
              <button
                onClick={async () => {
                  if (confirm('This will delete all downloaded AI models. Are you sure?')) {
                    try {
                      await modelManager.clearAllModels()
                      await loadData()
                    } catch (error) {
                      console.error('Failed to clear models:', error)
                      alert('Failed to clear models. Please try again.')
                    }
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Clear All Models
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                This will free up storage space but models will need to be re-downloaded
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
