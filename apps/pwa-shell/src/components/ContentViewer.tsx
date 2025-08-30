'use client'
import { useState, useEffect } from 'react'
import { Doc } from '@/lib/search'

interface ContentViewerProps {
  doc: Doc | null
  className?: string
}

export default function ContentViewer({ doc, className = '' }: ContentViewerProps) {
  const [isLoading, setIsLoading] = useState(false)
  
  if (!doc) {
    return (
      <div className={`p-6 opacity-70 text-sm ${className}`}>
        <div className="text-center space-y-4">
          <div className="text-2xl">📖</div>
          <div>Select a search result to view detailed information.</div>
          <div className="text-xs text-neutral-500">
            Articles are cached locally for offline access.
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className={`p-6 space-y-4 ${className}`}>
      {/* Header */}
      <div className="border-b border-neutral-700 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-neutral-100">{doc.title}</h1>
            {doc.category && (
              <span className={`inline-block px-2 py-1 text-xs rounded-full ${getCategoryColor(doc.category)}`}>
                {doc.category.replace('-', ' ')}
              </span>
            )}
          </div>
          {doc.priority && (
            <div className={`px-2 py-1 text-xs rounded ${getPriorityColor(doc.priority)}`}>
              {doc.priority} priority
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      {doc.summary && (
        <div className="bg-neutral-800 p-4 rounded-lg">
          <h2 className="text-sm font-medium mb-2 text-neutral-300">Quick Summary</h2>
          <p className="text-neutral-100">{doc.summary}</p>
        </div>
      )}

      {/* Content */}
      {doc.content && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-neutral-300">Detailed Information</h2>
          <div className="prose prose-invert max-w-none">
            <p className="text-neutral-100 leading-relaxed">
              {doc.content}
            </p>
          </div>
        </div>
      )}

      {/* Keywords */}
      {doc.keywords && doc.keywords.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-neutral-300">Related Topics</h3>
          <div className="flex flex-wrap gap-2">
            {doc.keywords.map((keyword, index) => (
              <span
                key={index}
                className="px-2 py-1 text-xs bg-blue-900 text-blue-200 rounded hover:bg-blue-800 cursor-pointer"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Emergency Notice */}
      {doc.priority === 'high' && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mt-6">
          <div className="flex items-center space-x-2">
            <span className="text-red-400">⚠️</span>
            <span className="text-sm font-medium text-red-300">Emergency Information</span>
          </div>
          <p className="text-sm text-red-200 mt-1">
            This is critical emergency information. In a real emergency, call 911 or your local emergency services immediately.
          </p>
        </div>
      )}

      {/* Offline Status */}
      <div className="text-xs text-neutral-500 text-center pt-4 border-t border-neutral-800">
        📱 Content cached for offline access • Last updated: {new Date().toLocaleDateString()}
      </div>
    </div>
  )
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    'medical': 'bg-red-900 text-red-200',
    'safety': 'bg-orange-900 text-orange-200', 
    'survival': 'bg-green-900 text-green-200',
    'natural-disaster': 'bg-yellow-900 text-yellow-200',
    'planning': 'bg-blue-900 text-blue-200',
    'utilities': 'bg-purple-900 text-purple-200',
  }
  return colors[category] || 'bg-neutral-700 text-neutral-300'
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    'high': 'bg-red-700 text-red-100',
    'medium': 'bg-yellow-700 text-yellow-100',
    'low': 'bg-green-700 text-green-100',
  }
  return colors[priority] || 'bg-neutral-700 text-neutral-300'
}
