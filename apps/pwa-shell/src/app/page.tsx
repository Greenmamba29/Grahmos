'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import useOnline from '@/lib/useOnline'
import { useOfflineSearch, type Doc } from '@/lib/search'
import ContentViewer from '@/components/ContentViewer'
import PurchaseModal from './purchase/PurchaseModal'
import dynamic from 'next/dynamic'
import AIAssistant from './components/AIAssistant'
import { AISearchBar } from '@/components/AISearchBar'
import { AISearchSettings } from '@/components/AISearchSettings'
import type { AISearchResponse } from 'ai-search'

// Dynamic import for map component to avoid SSR issues
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh] bg-neutral-900 border border-neutral-800 rounded-xl">
      <div className="text-sm text-neutral-400">Loading mapping system...</div>
    </div>
  )
})

export default function Page(){
  const online = useOnline()
  const { loading, error, search } = useOfflineSearch()
  const [q,setQ] = useState('')
  const [results,setResults] = useState<Doc[]>([])
  const [aiSearchResults, setAiSearchResults] = useState<AISearchResponse | null>(null)
  const [activeDoc, setActiveDoc] = useState<Doc | null>(null)
  const [showBuy, setShowBuy] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<'search' | 'mapping' | 'assistant'>('search')

  // Comprehensive emergency overlays with realistic Bay Area data
  const emergencyOverlays = [
    // Evacuation Points (Shelters & Safety Centers)
    {
      id: 'shelter-moscone',
      type: 'evacuation-point' as const,
      coordinates: [[-122.4039, 37.7840]], // Moscone Center
      properties: {
        name: 'Moscone Center Emergency Shelter',
        description: 'Primary evacuation center - capacity 5,000',
        priority: 'high' as const,
        status: 'active' as const
      }
    },
    {
      id: 'shelter-presidio',
      type: 'evacuation-point' as const,
      coordinates: [[-122.4662, 37.7955]], // Presidio
      properties: {
        name: 'Presidio Emergency Center',
        description: 'Secondary shelter with medical facilities',
        priority: 'high' as const,
        status: 'active' as const
      }
    },
    {
      id: 'shelter-ggpark',
      type: 'evacuation-point' as const,
      coordinates: [[-122.4530, 37.7694]], // Golden Gate Park
      properties: {
        name: 'Golden Gate Park Assembly Area',
        description: 'Open area gathering point',
        priority: 'medium' as const,
        status: 'active' as const
      }
    },
    
    // Evacuation Routes
    {
      id: 'route-market-west',
      type: 'evacuation-route' as const,
      coordinates: [[-122.4194, 37.7749], [-122.4662, 37.7955]], // Market St to Presidio
      properties: {
        name: 'Market Street to Presidio Route',
        description: 'Primary westbound evacuation corridor',
        priority: 'high' as const,
        status: 'active' as const
      }
    },
    {
      id: 'route-19th-avenue',
      type: 'evacuation-route' as const,
      coordinates: [[-122.4269, 37.7849], [-122.4269, 37.7200]], // 19th Ave north-south
      properties: {
        name: '19th Avenue Evacuation Corridor',
        description: 'Major north-south evacuation route',
        priority: 'high' as const,
        status: 'active' as const
      }
    },
    {
      id: 'route-geary',
      type: 'evacuation-route' as const,
      coordinates: [[-122.4039, 37.7840], [-122.5089, 37.7816]], // Geary Blvd
      properties: {
        name: 'Geary Boulevard Evacuation Route',
        description: 'East-west evacuation corridor to Ocean Beach',
        priority: 'medium' as const,
        status: 'active' as const
      }
    },
    
    // Hazard Zones
    {
      id: 'hazard-marina',
      type: 'hazard-zone' as const,
      coordinates: [[-122.4662, 37.8055], [-122.4400, 37.8055], [-122.4400, 37.7955], [-122.4662, 37.7955]], // Marina District
      properties: {
        name: 'Marina District Liquefaction Zone',
        description: 'High earthquake liquefaction risk area',
        priority: 'high' as const,
        status: 'active' as const
      }
    },
    {
      id: 'hazard-soma-flood',
      type: 'hazard-zone' as const,
      coordinates: [[-122.4039, 37.7749], [-122.3900, 37.7749], [-122.3900, 37.7649], [-122.4039, 37.7649]], // SOMA flood zone
      properties: {
        name: 'SOMA Flood Risk Zone',
        description: 'Sea level rise and storm surge vulnerability',
        priority: 'medium' as const,
        status: 'active' as const
      }
    },
    {
      id: 'hazard-wildfire',
      type: 'hazard-zone' as const,
      coordinates: [[-122.5200, 37.7600], [-122.4800, 37.7600], [-122.4800, 37.7300], [-122.5200, 37.7300]], // Western hills
      properties: {
        name: 'Wildfire Risk Zone - Western Hills',
        description: 'High wildfire danger during dry conditions',
        priority: 'medium' as const,
        status: 'active' as const
      }
    },
    
    // Safe Zones
    {
      id: 'safe-ggpark',
      type: 'safe-zone' as const,
      coordinates: [[-122.4750, 37.7730], [-122.4530, 37.7730], [-122.4530, 37.7650], [-122.4750, 37.7650]], // Golden Gate Park
      properties: {
        name: 'Golden Gate Park Safe Zone',
        description: 'Large open area away from buildings',
        priority: 'high' as const,
        status: 'active' as const
      }
    },
    {
      id: 'safe-crissy',
      type: 'safe-zone' as const,
      coordinates: [[-122.4700, 37.8055], [-122.4500, 37.8055], [-122.4500, 37.8000], [-122.4700, 37.8000]], // Crissy Field
      properties: {
        name: 'Crissy Field Safe Assembly Area',
        description: 'Open field with emergency access',
        priority: 'high' as const,
        status: 'active' as const
      }
    },
    {
      id: 'safe-mission-dolores',
      type: 'safe-zone' as const,
      coordinates: [[-122.4269, 37.7649], [-122.4200, 37.7649], [-122.4200, 37.7600], [-122.4269, 37.7600]], // Mission Dolores Park
      properties: {
        name: 'Mission Dolores Park Assembly Area',
        description: 'Designated community gathering point',
        priority: 'medium' as const,
        status: 'active' as const
      }
    }
  ]

  const performSearch = useCallback(async () => {
    if(q.trim().length===0){ setResults([]); return }
    const r = await search(q.trim())
    setResults(r)
  }, [q, search])

  useEffect(()=>{
    const t = setTimeout(performSearch, 150)
    return ()=>clearTimeout(t)
  },[performSearch])

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="border-b border-neutral-800">
        <div className="flex space-x-1">
          <button
            className={`py-3 px-4 border-b-2 font-medium text-sm rounded-t-lg transition-colors ${
              activeTab === 'search'
                ? 'border-blue-500 text-blue-300 bg-neutral-900'
                : 'border-transparent text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800'
            }`}
            onClick={() => setActiveTab('search')}
          >
            🤖 AI-Enhanced Search
          </button>
          <button
            className={`py-3 px-4 border-b-2 font-medium text-sm rounded-t-lg transition-colors ${
              activeTab === 'mapping'
                ? 'border-blue-500 text-blue-300 bg-neutral-900'
                : 'border-transparent text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800'
            }`}
            onClick={() => setActiveTab('mapping')}
          >
            🗺️ Emergency Mapping
          </button>
          <button
            className={`py-3 px-4 border-b-2 font-medium text-sm rounded-t-lg transition-colors ${
              activeTab === 'assistant'
                ? 'border-blue-500 text-blue-300 bg-neutral-900'
                : 'border-transparent text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800'
            }`}
            onClick={() => setActiveTab('assistant')}
          >
            🤖 AI Assistant
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'search' ? (
        <div className="space-y-4">
          {/* AI Search Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-sm">🤖</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-100">
                  AI-Enhanced Search
                </h2>
                <p className="text-xs text-neutral-400">
                  Intelligent, context-aware search with offline capabilities
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`text-xs px-2 py-1 rounded ${online ? 'bg-emerald-700' : 'bg-amber-700'}`}>
                {online ? 'Online' : 'Offline'}
              </span>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-neutral-300"
                title="AI Search Settings"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>

          {/* AI Search Bar */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <AISearchBar
              onResults={(results) => {
                setAiSearchResults(results)
                // Update activeDoc if we have results
                if (results.results.length > 0) {
                  setActiveDoc(results.results[0])
                }
              }}
              placeholder="Ask anything... AI understands your context 🤖"
              showSuggestions={true}
              showAISummary={true}
              className="mb-4"
            />

            {/* Quick Search Suggestions */}
            {!aiSearchResults && (
              <div className="mt-4">
                <div className="text-sm text-neutral-300 mb-3">
                  💡 **Suggested searches:**
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    'earthquake preparedness',
                    'first aid basics', 
                    'emergency water storage',
                    'evacuation planning',
                    'fire safety tips',
                    'power outage survival',
                    'emergency communication',
                    'natural disaster recovery'
                  ].map(term => (
                    <button
                      key={term}
                      className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors text-left text-xs"
                      onClick={() => {
                        // Trigger AI search with the term
                        const event = new Event('input', { bubbles: true })
                        const searchInput = document.querySelector('input[placeholder*="Ask anything"]') as HTMLInputElement
                        if (searchInput) {
                          searchInput.value = term
                          searchInput.dispatchEvent(event)
                          searchInput.focus()
                        }
                      }}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl">
              <AISearchSettings onClose={() => setShowSettings(false)} />
            </div>
          )}

          {/* Search Results */}
          {aiSearchResults && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* AI Search Results Panel */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-neutral-100">Search Results</h3>
                  <div className="text-xs text-neutral-400">
                    {aiSearchResults.results.length} results • {aiSearchResults.processingTime < 1000 
                      ? `${aiSearchResults.processingTime}ms` 
                      : `${(aiSearchResults.processingTime / 1000).toFixed(1)}s`}
                  </div>
                </div>

                {/* AI Summary */}
                {aiSearchResults.aiSummary && (
                  <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 mb-4">
                    <div className="flex items-start space-x-2">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mt-0.5">
                        <span className="text-xs">🤖</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-blue-300 mb-1">AI Summary</h4>
                        <p className="text-sm text-blue-100">{aiSearchResults.aiSummary}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Results List */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {aiSearchResults.results.map((result, index) => (
                    <div
                      key={result.id}
                      className={`p-3 border border-neutral-700 rounded-lg cursor-pointer transition-colors hover:bg-neutral-800 ${
                        activeDoc?.id === result.id ? 'bg-neutral-800 border-blue-600' : ''
                      }`}
                      onClick={() => setActiveDoc(result)}
                    >
                      <div className="flex items-start space-x-3">
                        {result.aiEnhanced && (
                          <div className="flex-shrink-0 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-xs">✨</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-neutral-100 text-sm">{result.title}</h4>
                          
                          {result.aiSummary && (
                            <div className="mt-2 p-2 bg-blue-900/20 rounded text-xs">
                              <span className="text-blue-300 font-medium">🤖 AI:</span>
                              <span className="text-blue-100 ml-1">{result.aiSummary}</span>
                            </div>
                          )}
                          
                          {result.summary && (
                            <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{result.summary}</p>
                          )}
                          
                          <div className="flex items-center mt-2 space-x-2">
                            {result.category && (
                              <span className={`inline-block px-2 py-0.5 text-xs rounded ${getCategoryColorSmall(result.category)}`}>
                                {result.category.replace('-', ' ')}
                              </span>
                            )}
                            {result.contextRelevance !== undefined && (
                              <span className="text-xs text-green-400">
                                🎯 {Math.round(result.contextRelevance * 100)}% match
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Suggested Queries */}
                {aiSearchResults.suggestedQueries.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-neutral-800">
                    <h4 className="text-sm font-medium text-neutral-300 mb-2">AI Suggestions</h4>
                    <div className="flex flex-wrap gap-2">
                      {aiSearchResults.suggestedQueries.map((query, index) => (
                        <button
                          key={index}
                          className="text-xs px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors"
                          onClick={() => {
                            const searchInput = document.querySelector('input[placeholder*="Ask anything"]') as HTMLInputElement
                            if (searchInput) {
                              searchInput.value = query
                              const event = new Event('input', { bubbles: true })
                              searchInput.dispatchEvent(event)
                              searchInput.focus()
                            }
                          }}
                        >
                          ⚡ {query}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Content Viewer */}
              <div className="border border-neutral-800 rounded-xl overflow-hidden">
                <ContentViewer doc={activeDoc} className="h-[70vh] overflow-y-auto" />
              </div>
            </div>
          )}

          {/* Fallback to basic search if no AI results */}
          {!aiSearchResults && results.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <h3 className="text-lg font-medium text-neutral-100 mb-4">Basic Search Results</h3>
                <ul className="divide-y divide-neutral-800">
                  {results.map((r: Doc) => (
                    <li 
                      key={r.id} 
                      className={`p-3 hover:bg-neutral-800 cursor-pointer transition-colors ${
                        activeDoc?.id === r.id ? 'bg-neutral-800 border-l-2 border-blue-500' : ''
                      }`} 
                      onClick={() => setActiveDoc(r)}
                    >
                      <div className="font-medium text-neutral-100">{r.title}</div>
                      {r.summary && <div className="opacity-60 text-sm line-clamp-2 text-neutral-400">{r.summary}</div>}
                      {r.category && (
                        <div className={`inline-block px-1 py-0.5 text-xs rounded mt-1 ${getCategoryColorSmall(r.category)}`}>
                          {r.category.replace('-', ' ')}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border border-neutral-800 rounded-xl overflow-hidden">
                <ContentViewer doc={activeDoc} className="h-[70vh] overflow-y-auto" />
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'mapping' ? (
        /* Mapping Tab Content */
        <div className="h-[80vh] border border-neutral-800 rounded-xl overflow-hidden">
          <MapView 
            overlays={emergencyOverlays}
            onLocationSelect={(lat, lng) => {
              console.log('Selected location:', lat, lng)
              // Could trigger search for location-specific information
            }}
            initialViewport={{
              latitude: 37.7749,
              longitude: -122.4194,
              zoom: 12
            }}
          />
        </div>
      ) : (
        /* AI Assistant Tab Content */
        <div className="space-y-4">
          <div className="text-sm text-neutral-400 mb-4">
            Ask the AI assistant about emergency preparedness, first aid, navigation, or any other questions.
          </div>
          <AIAssistant className="w-full" />
        </div>
      )}

      {showBuy && (
        <PurchaseModal 
          item={{ id:'kit_first_aid', name:'First Aid Kit', price:29.99 }} 
          onClose={() => setShowBuy(false)} 
        />
      )}
    </div>
  )
}

// Helper function for small category colors
function getCategoryColorSmall(category: string): string {
  const colors: Record<string, string> = {
    'medical': 'bg-red-800 text-red-200',
    'safety': 'bg-orange-800 text-orange-200', 
    'survival': 'bg-green-800 text-green-200',
    'natural-disaster': 'bg-yellow-800 text-yellow-200',
    'planning': 'bg-blue-800 text-blue-200',
    'utilities': 'bg-purple-800 text-purple-200',
  }
  return colors[category] || 'bg-neutral-700 text-neutral-300'
}
