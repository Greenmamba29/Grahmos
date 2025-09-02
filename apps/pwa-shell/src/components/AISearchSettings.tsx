'use client'
import React, { useState, useEffect } from 'react'
import { getAISearchSettings, updateAISearchSettings, clearSearchMemory, getSearchAnalytics } from 'ai-search'
import type { AISearchSettings } from 'ai-search'

interface AISearchSettingsProps {
  onClose?: () => void
  className?: string
}

export function AISearchSettings({ onClose, className = "" }: AISearchSettingsProps) {
  const [settings, setSettings] = useState<AISearchSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [analytics, setAnalytics] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'settings' | 'analytics'>('settings')

  useEffect(() => {
    loadSettings()
    loadAnalytics()
  }, [])

  const loadSettings = async () => {
    try {
      const currentSettings = await getAISearchSettings()
      setSettings(currentSettings)
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAnalytics = async () => {
    try {
      const data = await getSearchAnalytics()
      setAnalytics(data)
    } catch (error) {
      console.error('Failed to load analytics:', error)
    }
  }

  const handleSettingChange = async (key: keyof AISearchSettings, value: any) => {
    if (!settings) return

    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)

    // Auto-save settings
    setSaving(true)
    try {
      await updateAISearchSettings({ [key]: value })
      setTimeout(() => setSaving(false), 500) // Show saving state briefly
    } catch (error) {
      console.error('Failed to save setting:', error)
      setSaving(false)
    }
  }

  const handleClearMemory = async () => {
    if (!confirm('Are you sure you want to clear all search memory? This cannot be undone.')) {
      return
    }

    try {
      await clearSearchMemory()
      await loadAnalytics() // Refresh analytics
      alert('Search memory cleared successfully!')
    } catch (error) {
      console.error('Failed to clear memory:', error)
      alert('Failed to clear memory. Please try again.')
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 ${className}`}>
        <p className="text-red-600 dark:text-red-400">Failed to load AI search settings.</p>
      </div>
    )
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <span className="text-sm">🤖</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              AI Search Settings
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure your intelligent search experience
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'settings'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Settings
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'analytics'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Analytics
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Memory Retention */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Memory Retention Period
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="range"
                  min="1"
                  max="168"
                  step="1"
                  value={settings.memoryRetentionHours}
                  onChange={(e) => handleSettingChange('memoryRetentionHours', parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400 w-20 text-right">
                  {settings.memoryRetentionHours}h
                  {settings.memoryRetentionHours >= 24 && (
                    <span className="text-xs block text-gray-500">
                      ({Math.round(settings.memoryRetentionHours / 24)}d)
                    </span>
                  )}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Search memories will be automatically deleted after this period
              </p>
            </div>

            {/* Context Memory Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Context Memory 🧠
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  AI remembers previous searches for better context awareness
                </p>
              </div>
              <button
                onClick={() => handleSettingChange('enableContextMemory', !settings.enableContextMemory)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  settings.enableContextMemory ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.enableContextMemory ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* AI Summaries Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  AI Summaries ✨
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Generate AI-powered summaries of search results
                </p>
              </div>
              <button
                onClick={() => handleSettingChange('enableAISummaries', !settings.enableAISummaries)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  settings.enableAISummaries ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.enableAISummaries ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Max Context Length */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Maximum Context Length
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="range"
                  min="1000"
                  max="10000"
                  step="500"
                  value={settings.maxContextLength}
                  onChange={(e) => handleSettingChange('maxContextLength', parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400 w-20 text-right">
                  {settings.maxContextLength.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Maximum characters to consider for AI processing
              </p>
            </div>

            {/* Danger Zone */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-sm font-medium text-red-700 dark:text-red-400 mb-3">
                Danger Zone
              </h3>
              <button
                onClick={handleClearMemory}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Clear All Search Memory
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                This will permanently delete all search history and context data
              </p>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && analytics && (
          <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {analytics.totalSearches}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Total Searches
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {analytics.averageResultsCount}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Avg Results
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatBytes(analytics.memoryUsage * 1024)}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Memory Usage
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  🤖
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  AI Enhanced
                </div>
              </div>
            </div>

            {/* Top Queries */}
            {analytics.topQueries.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Top Search Queries
                </h3>
                <div className="space-y-2">
                  {analytics.topQueries.slice(0, 5).map((item: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                        {item.query}
                      </span>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        {item.count}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Memory Management */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
                Memory Management
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Current retention: {settings.memoryRetentionHours} hours
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {analytics.memoryUsage}KB stored
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.min(100, (analytics.memoryUsage / 1024) * 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Memory will be automatically cleaned based on your retention settings
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Status */}
      {saving && (
        <div className="absolute top-4 right-16 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-3 py-1 rounded-full text-xs font-medium">
          ✓ Saved
        </div>
      )}
    </div>
  )
}
