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
        <div className="max-w-4xl mx-auto">
          {/* Modern Search Interface - Google/ChatGPT Style */}
          {(!results || results.length === 0) && !aiSearchResults ? (
            <div className="text-center py-16">
              {/* Logo */}
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-purple-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl">
                <span className="text-3xl">🤖</span>
              </div>
              
              {/* Title */}
              <h1 className="text-3xl font-bold text-white mb-2">
                Emergency AI Search
              </h1>
              <p className="text-lg text-neutral-400 mb-12">
                Get instant answers about emergency preparedness and safety
              </p>
              
              {/* Search Bar */}
              <div className="relative mb-8">
                <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                  <svg className="h-6 w-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  className="w-full pl-14 pr-6 py-5 text-lg bg-white/10 backdrop-blur-xl border border-white/20 rounded-full shadow-2xl placeholder-neutral-400 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent focus:bg-white/20 transition-all duration-300"
                  placeholder="Ask about first aid, disasters, evacuation..."
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && q.trim()) {
                      // Trigger search with current input
                      setResults([])
                      performSearch()
                    }
                  }}
                />
                {/* Status indicator */}
                <div className="absolute inset-y-0 right-0 pr-6 flex items-center">
                  <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                    online 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    <div className={`inline-block w-1.5 h-1.5 rounded-full mr-2 ${
                      online ? 'bg-emerald-400' : 'bg-amber-400'
                    } animate-pulse`}></div>
                    {online ? 'Online' : 'Offline'}
                  </div>
                </div>
              </div>
              
              {/* Quick suggestion pills */}
              <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
                {[
                  'earthquake safety',
                  'first aid basics',
                  'emergency water',
                  'evacuation plans',
                  'fire safety',
                  'power outages',
                  'hurricane prep',
                  'medical supplies'
                ].map(term => (
                  <button
                    key={term}
                    onClick={() => {
                      setQ(term)
                      setTimeout(() => performSearch(), 100)
                    }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full text-neutral-300 hover:text-white transition-all duration-300 backdrop-blur-sm shadow-lg hover:shadow-xl text-sm font-medium"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Search Results */
            <div className="space-y-6">
              {/* Search query display */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Results for &quot;{q}&quot;</h2>
                <button 
                  onClick={() => {
                    setQ('')
                    setResults([])
                    setActiveDoc(null)
                    setAiSearchResults(null)
                  }}
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  New search
                </button>
              </div>
              
              {/* Results grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Results list */}
                <div className="space-y-3">
                  {results.map((r: Doc) => (
                    <div
                      key={r.id}
                      className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                        activeDoc?.id === r.id 
                          ? 'bg-blue-500/20 border border-blue-500/30' 
                          : 'bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700/50'
                      }`}
                      onClick={() => setActiveDoc(r)}
                    >
                      <h3 className="font-medium text-white mb-2">{r.title}</h3>
                      {r.summary && (
                        <p className="text-sm text-neutral-300 line-clamp-3 mb-3">{r.summary}</p>
                      )}
                      {r.category && (
                        <span className={`inline-block px-3 py-1 text-xs rounded-full font-medium ${getCategoryColorSmall(r.category)}`}>
                          {r.category.replace('-', ' ')}
                        </span>
                      )}
                    </div>
                  ))}
                  
                  {loading && (
                    <div className="text-center py-8">
                      <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                      <p className="text-neutral-400">Searching...</p>
                    </div>
                  )}
                  
                  {results.length === 0 && !loading && (
                    <div className="text-center py-8">
                      <p className="text-neutral-400 mb-4">No results found for &quot;{q}&quot;</p>
                      <button 
                        onClick={() => setQ('first aid')}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        Try &quot;first aid&quot;
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Content viewer */}
                <div className="bg-neutral-800/30 border border-neutral-700/50 rounded-xl overflow-hidden">
                  <ContentViewer doc={activeDoc} className="h-[70vh] overflow-y-auto" />
                </div>
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
