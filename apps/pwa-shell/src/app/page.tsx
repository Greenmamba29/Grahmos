'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import useOnline from '@/lib/useOnline'
import { useOfflineSearch, type Doc } from '@/lib/search'
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
  const [activePath,setActivePath] = useState<string | null>(null)
  const [showBuy, setShowBuy] = useState(false)
  const [activeTab, setActiveTab] = useState<'search' | 'mapping' | 'assistant'>('search')
  const iframeRef = useRef<HTMLIFrameElement|null>(null)

  // Sample emergency overlays for mapping demo
  const emergencyOverlays = [
    {
      id: 'evac-1',
      type: 'evacuation-point' as const,
      coordinates: [[-122.4194, 37.7749]], // San Francisco
      properties: {
        name: 'Emergency Shelter A',
        description: 'Primary evacuation center',
        priority: 'high' as const,
        status: 'active' as const
      }
    },
    {
      id: 'route-1', 
      type: 'evacuation-route' as const,
      coordinates: [[-122.4194, 37.7749], [-122.4094, 37.7849]], // Route path
      properties: {
        name: 'Main Evacuation Route',
        priority: 'high' as const,
        status: 'active' as const
      }
    },
    {
      id: 'hazard-1',
      type: 'hazard-zone' as const, 
      coordinates: [[-122.43, 37.77], [-122.42, 37.77], [-122.42, 37.78], [-122.43, 37.78]], // Polygon
      properties: {
        name: 'Flood Risk Area',
        description: 'High flood risk during storms',
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
            <li key={r.id} className="p-3 hover:bg-neutral-900 cursor-pointer" onClick={()=>setActivePath(r.url)}>
              <div className="font-medium">{r.title}</div>
              {r.summary && <div className="opacity-60 text-sm line-clamp-2">{r.summary}</div>}
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

          <div className="border border-neutral-800 rounded-xl overflow-hidden min-h-[60vh]">
            {!activePath ? (
              <div className="p-6 opacity-70 text-sm">Select a result to open. Articles will be loaded via <code>/api/kiwix?path=…</code> and cached for offline revisit.</div>
            ) : (
              <iframe ref={iframeRef} className="w-full h-[70vh] bg-white" src={`/api/kiwix?path=${encodeURIComponent(activePath)}`} />
            )}
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
