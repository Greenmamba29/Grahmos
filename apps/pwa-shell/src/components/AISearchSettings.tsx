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
        )}\n      </div>\n\n      {/* Tabs */}\n      <div className=\"flex border-b border-gray-200 dark:border-gray-700\">\n        <button\n          onClick={() => setActiveTab('settings')}\n          className={`px-6 py-3 text-sm font-medium transition-colors ${\n            activeTab === 'settings'\n              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'\n              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'\n          }`}\n        >\n          Settings\n        </button>\n        <button\n          onClick={() => setActiveTab('analytics')}\n          className={`px-6 py-3 text-sm font-medium transition-colors ${\n            activeTab === 'analytics'\n              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'\n              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'\n          }`}\n        >\n          Analytics\n        </button>\n      </div>\n\n      {/* Content */}\n      <div className=\"p-6\">\n        {activeTab === 'settings' && (\n          <div className=\"space-y-6\">\n            {/* Memory Retention */}\n            <div>\n              <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2\">\n                Memory Retention Period\n              </label>\n              <div className=\"flex items-center space-x-3\">\n                <input\n                  type=\"range\"\n                  min=\"1\"\n                  max=\"168\"\n                  step=\"1\"\n                  value={settings.memoryRetentionHours}\n                  onChange={(e) => handleSettingChange('memoryRetentionHours', parseInt(e.target.value))}\n                  className=\"flex-1\"\n                />\n                <span className=\"text-sm text-gray-600 dark:text-gray-400 w-20 text-right\">\n                  {settings.memoryRetentionHours}h\n                  {settings.memoryRetentionHours >= 24 && (\n                    <span className=\"text-xs block text-gray-500\">\n                      ({Math.round(settings.memoryRetentionHours / 24)}d)\n                    </span>\n                  )}\n                </span>\n              </div>\n              <p className=\"text-xs text-gray-500 dark:text-gray-400 mt-1\">\n                Search memories will be automatically deleted after this period\n              </p>\n            </div>\n\n            {/* Context Memory Toggle */}\n            <div className=\"flex items-center justify-between\">\n              <div>\n                <h3 className=\"text-sm font-medium text-gray-700 dark:text-gray-300\">\n                  Context Memory 🧠\n                </h3>\n                <p className=\"text-xs text-gray-500 dark:text-gray-400\">\n                  AI remembers previous searches for better context awareness\n                </p>\n              </div>\n              <button\n                onClick={() => handleSettingChange('enableContextMemory', !settings.enableContextMemory)}\n                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${\n                  settings.enableContextMemory ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'\n                }`}\n              >\n                <span\n                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${\n                    settings.enableContextMemory ? 'translate-x-5' : 'translate-x-0'\n                  }`}\n                />\n              </button>\n            </div>\n\n            {/* AI Summaries Toggle */}\n            <div className=\"flex items-center justify-between\">\n              <div>\n                <h3 className=\"text-sm font-medium text-gray-700 dark:text-gray-300\">\n                  AI Summaries ✨\n                </h3>\n                <p className=\"text-xs text-gray-500 dark:text-gray-400\">\n                  Generate AI-powered summaries of search results\n                </p>\n              </div>\n              <button\n                onClick={() => handleSettingChange('enableAISummaries', !settings.enableAISummaries)}\n                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${\n                  settings.enableAISummaries ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'\n                }`}\n              >\n                <span\n                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${\n                    settings.enableAISummaries ? 'translate-x-5' : 'translate-x-0'\n                  }`}\n                />\n              </button>\n            </div>\n\n            {/* Max Context Length */}\n            <div>\n              <label className=\"block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2\">\n                Maximum Context Length\n              </label>\n              <div className=\"flex items-center space-x-3\">\n                <input\n                  type=\"range\"\n                  min=\"1000\"\n                  max=\"10000\"\n                  step=\"500\"\n                  value={settings.maxContextLength}\n                  onChange={(e) => handleSettingChange('maxContextLength', parseInt(e.target.value))}\n                  className=\"flex-1\"\n                />\n                <span className=\"text-sm text-gray-600 dark:text-gray-400 w-20 text-right\">\n                  {settings.maxContextLength.toLocaleString()}\n                </span>\n              </div>\n              <p className=\"text-xs text-gray-500 dark:text-gray-400 mt-1\">\n                Maximum characters to consider for AI processing\n              </p>\n            </div>\n\n            {/* Danger Zone */}\n            <div className=\"border-t border-gray-200 dark:border-gray-700 pt-6\">\n              <h3 className=\"text-sm font-medium text-red-700 dark:text-red-400 mb-3\">\n                Danger Zone\n              </h3>\n              <button\n                onClick={handleClearMemory}\n                className=\"px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors\"\n              >\n                Clear All Search Memory\n              </button>\n              <p className=\"text-xs text-gray-500 dark:text-gray-400 mt-2\">\n                This will permanently delete all search history and context data\n              </p>\n            </div>\n          </div>\n        )}\n\n        {activeTab === 'analytics' && analytics && (\n          <div className=\"space-y-6\">\n            {/* Overview Stats */}\n            <div className=\"grid grid-cols-2 md:grid-cols-4 gap-4\">\n              <div className=\"bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg\">\n                <div className=\"text-2xl font-bold text-gray-900 dark:text-gray-100\">\n                  {analytics.totalSearches}\n                </div>\n                <div className=\"text-sm text-gray-500 dark:text-gray-400\">\n                  Total Searches\n                </div>\n              </div>\n              <div className=\"bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg\">\n                <div className=\"text-2xl font-bold text-gray-900 dark:text-gray-100\">\n                  {analytics.averageResultsCount}\n                </div>\n                <div className=\"text-sm text-gray-500 dark:text-gray-400\">\n                  Avg Results\n                </div>\n              </div>\n              <div className=\"bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg\">\n                <div className=\"text-2xl font-bold text-gray-900 dark:text-gray-100\">\n                  {formatBytes(analytics.memoryUsage * 1024)}\n                </div>\n                <div className=\"text-sm text-gray-500 dark:text-gray-400\">\n                  Memory Usage\n                </div>\n              </div>\n              <div className=\"bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg\">\n                <div className=\"text-2xl font-bold text-blue-600 dark:text-blue-400\">\n                  🤖\n                </div>\n                <div className=\"text-sm text-gray-500 dark:text-gray-400\">\n                  AI Enhanced\n                </div>\n              </div>\n            </div>\n\n            {/* Top Queries */}\n            {analytics.topQueries.length > 0 && (\n              <div>\n                <h3 className=\"text-lg font-medium text-gray-900 dark:text-gray-100 mb-3\">\n                  Top Search Queries\n                </h3>\n                <div className=\"space-y-2\">\n                  {analytics.topQueries.slice(0, 5).map((item: any, index: number) => (\n                    <div key={index} className=\"flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg\">\n                      <span className=\"text-sm text-gray-700 dark:text-gray-300 truncate\">\n                        {item.query}\n                      </span>\n                      <span className=\"text-sm font-medium text-gray-500 dark:text-gray-400\">\n                        {item.count}x\n                      </span>\n                    </div>\n                  ))}\n                </div>\n              </div>\n            )}\n\n            {/* Memory Management */}\n            <div>\n              <h3 className=\"text-lg font-medium text-gray-900 dark:text-gray-100 mb-3\">\n                Memory Management\n              </h3>\n              <div className=\"bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg\">\n                <div className=\"flex items-center justify-between mb-2\">\n                  <span className=\"text-sm text-gray-700 dark:text-gray-300\">\n                    Current retention: {settings.memoryRetentionHours} hours\n                  </span>\n                  <span className=\"text-sm text-gray-500 dark:text-gray-400\">\n                    {analytics.memoryUsage}KB stored\n                  </span>\n                </div>\n                <div className=\"w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2\">\n                  <div \n                    className=\"bg-blue-600 h-2 rounded-full transition-all duration-300\" \n                    style={{ width: `${Math.min(100, (analytics.memoryUsage / 1024) * 100)}%` }}\n                  ></div>\n                </div>\n                <p className=\"text-xs text-gray-500 dark:text-gray-400 mt-2\">\n                  Memory will be automatically cleaned based on your retention settings\n                </p>\n              </div>\n            </div>\n          </div>\n        )}\n      </div>\n\n      {/* Save Status */}\n      {saving && (\n        <div className=\"absolute top-4 right-16 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-3 py-1 rounded-full text-xs font-medium\">\n          ✓ Saved\n        </div>\n      )}\n    </div>\n  )\n}
