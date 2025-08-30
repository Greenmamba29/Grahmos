'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import useOnline from '@/lib/useOnline'
import { useOfflineSearch, type Doc } from '@/lib/search'
import ContentViewer from '@/components/ContentViewer'
import PurchaseModal from './purchase/PurchaseModal'
import dynamic from 'next/dynamic'
import AIAssistant from './components/AIAssistant'

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
  const [activeDoc, setActiveDoc] = useState<Doc | null>(null)
  const [showBuy, setShowBuy] = useState(false)
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
        <div className="flex space-x-8">
          <button
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'search'
                ? 'border-blue-500 text-blue-300'
                : 'border-transparent text-neutral-400 hover:text-neutral-300'
            }`}
            onClick={() => setActiveTab('search')}
          >
            🔍 Search & Documentation
          </button>
          <button
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'mapping'
                ? 'border-blue-500 text-blue-300'
                : 'border-transparent text-neutral-400 hover:text-neutral-300'
            }`}
            onClick={() => setActiveTab('mapping')}
          >
            🗺️ Emergency Mapping
          </button>
          <button
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'assistant'
                ? 'border-blue-500 text-blue-300'
                : 'border-transparent text-neutral-400 hover:text-neutral-300'
            }`}
            onClick={() => setActiveTab('assistant')}
          >
            🤖 AI Assistant
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'search' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2"
                placeholder={loading? 'Indexing…':'Search offline…'}
                value={q}
                onChange={e=>setQ(e.target.value)}
              />
              <span className={`text-xs px-2 py-1 rounded ${online? 'bg-emerald-700':'bg-amber-700'}`}>
                {online? 'Online':'Offline'}
              </span>
            </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <ul className="divide-y divide-neutral-800 rounded-lg overflow-hidden border border-neutral-800">
          {results.map((r: Doc)=> (
            <li 
              key={r.id} 
              className={`p-3 hover:bg-neutral-900 cursor-pointer transition-colors ${
                activeDoc?.id === r.id ? 'bg-neutral-800 border-l-2 border-blue-500' : ''
              }`} 
              onClick={()=>setActiveDoc(r)}
            >
              <div className="font-medium">{r.title}</div>
              {r.summary && <div className="opacity-60 text-sm line-clamp-2">{r.summary}</div>}
              {r.category && (
                <div className={`inline-block px-1 py-0.5 text-xs rounded mt-1 ${getCategoryColorSmall(r.category)}`}>
                  {r.category.replace('-', ' ')}
                </div>
              )}
            </li>
          ))}
          {(!results || results.length===0) && !loading && (
            <li className="p-3 opacity-60 text-sm">
              No results yet. Try &quot;First Aid&quot;
              <button 
                className="ml-3 px-2 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600" 
                onClick={() => setShowBuy(true)}
              >
                Buy First Aid Kit
              </button>
            </li>
          )}
        </ul>
          </div>

          <div className="border border-neutral-800 rounded-xl overflow-hidden min-h-[60vh] bg-neutral-900">
            <ContentViewer doc={activeDoc} className="h-[60vh] overflow-y-auto" />
          </div>
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
