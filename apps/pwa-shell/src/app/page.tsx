'use client'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import useOnline from '@/lib/useOnline'
import { useOfflineSearch, type Doc } from '@/lib/search'
import PurchaseModal from './purchase/PurchaseModal'
import FiltersComponent from './(components)/Filters'
import { getAppSettings, getSyncPassphrase, getBatteryProfile, getAutoBatteryProfile } from '../lib/settings'
import { startPeerSync, deriveKey, updateCadence, applyProfile } from '../../../../packages/p2p-delta/src/peerSync'
import { db } from '../../../../packages/local-db/src/db'
import { addDocs } from '../../../../packages/search-core/src'
import { Filters } from '../lib/filters'

export default function Page(){
  const online = useOnline()
  const { loading, error, search } = useOfflineSearch()
  const [q,setQ] = useState('')
  const [results,setResults] = useState<Doc[]>([])
  const [activePath,setActivePath] = useState<string | null>(null)
  const [showBuy, setShowBuy] = useState(false)
  const [redMode, setRedMode] = useState(false)
  const [batteryProfile, setBatteryProfile] = useState<'normal' | 'red' | 'lowPower' | 'auto'>('auto')
  const [filters, setFilters] = useState<Filters>({ category: [], availability: 'any' })
  const iframeRef = useRef<HTMLIFrameElement|null>(null)

  useEffect(() => {
    getAppSettings().then(settings => {
      setRedMode(settings.redMode)
      setBatteryProfile(settings.batteryProfile)
      // Apply initial battery profile
      applyProfile(settings.batteryProfile, settings.redMode)
    })
    
    const initPeerSync = async () => {
      try {
        const passphrase = await getSyncPassphrase()
        if (!passphrase) {
          console.log('No sync passphrase set, skipping peer sync')
          return
        }

        // Get WebRTC star URL from environment or use default for development
        const starUrl = process.env.NEXT_PUBLIC_WEBRTC_STAR_URL || ''
        
        const sync = await startPeerSync({
          topic: 'grahmos-sync-v1',
          starUrl: starUrl || undefined,
          getKey: async () => {
            const { key } = await deriveKey(passphrase)
            return key
          },
          onDoc: async (doc: Doc) => {
            console.log('Received doc via peer sync:', doc.id)
            await db.docs.put(doc)
            await addDocs([doc])
            const windowWithSync = window as typeof window & { __sync?: { lastMessageTime: number; getDiagnostics?: () => unknown } }
            if (windowWithSync.__sync) {
              windowWithSync.__sync.lastMessageTime = Date.now()
            }
          }
        })

        if (typeof window !== 'undefined') {
          const windowWithSync = window as typeof window & { __sync: { publish: (doc: Doc) => Promise<void>; getPeers: () => number; lastMessageTime: number | null; getDiagnostics: () => unknown } }
          windowWithSync.__sync = {
            publish: sync.publish,
            getPeers: sync.getPeers,
            getDiagnostics: sync.getDiagnostics,
            lastMessageTime: null
          }
        }

        console.log('Peer sync initialized')
      } catch (e) {
        console.error('Failed to initialize peer sync:', e)
      }
    }

    initPeerSync()
    
    // Listen for visibility changes for auto battery profile
    const handleVisibilityChange = async () => {
      const currentProfile = await getBatteryProfile()
      if (currentProfile === 'auto') {
        const settings = await getAppSettings()
        const effectiveProfile = await getAutoBatteryProfile(settings.redMode)
        console.log(`Visibility changed, applying auto profile: ${effectiveProfile}`)
        applyProfile('auto', settings.redMode)
      }
    }
    
    // Listen for network connection changes
    const handleConnectionChange = async () => {
      const currentProfile = await getBatteryProfile()
      if (currentProfile === 'auto') {
        const settings = await getAppSettings()
        const effectiveProfile = await getAutoBatteryProfile(settings.redMode)
        console.log(`Connection changed, applying auto profile: ${effectiveProfile}`)
        applyProfile('auto', settings.redMode)
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    if ('connection' in navigator) {
      (navigator as any).connection?.addEventListener?.('change', handleConnectionChange)
    }
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if ('connection' in navigator) {
        (navigator as any).connection?.removeEventListener?.('change', handleConnectionChange)
      }
    }
  }, [])
  
  // Handle red mode changes
  useEffect(() => {
    const updateProfileForRedMode = async () => {
      const currentProfile = await getBatteryProfile()
      if (currentProfile === 'auto') {
        applyProfile('auto', redMode)
      } else if (currentProfile === 'red' || redMode) {
        applyProfile('red', redMode)
      }
    }
    updateProfileForRedMode()
  }, [redMode])

  const performSearch = useCallback(async () => {
    if(q.trim().length===0){ setResults([]); return }
    const r = await search(q.trim())
    setResults(r)
  }, [q, search])

  useEffect(()=>{
    const t = setTimeout(performSearch, 150)
    return ()=>clearTimeout(t)
  },[performSearch])

  // Derive unique categories from current results
  const categories = useMemo(() => {
    const cats = new Set<string>()
    results.forEach(doc => {
      if (doc.category && typeof doc.category === 'string') {
        cats.add(doc.category)
      }
    })
    return Array.from(cats).sort()
  }, [results])

  // Console log filter changes
  const handleFiltersChange = useCallback((newFilters: Filters) => {
    console.log('Filters value', newFilters)
    setFilters(newFilters)
  }, [])

  return (
    <div className="space-y-4">
      {redMode && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-200 mb-3">Emergency Panel</h2>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button className="px-3 py-2 bg-red-700 hover:bg-red-600 rounded text-sm">
              First Aid
            </button>
            <button className="px-3 py-2 bg-red-700 hover:bg-red-600 rounded text-sm">
              Evacuation
            </button>
          </div>
          <div className="text-sm text-red-300">
            <div className="font-medium mb-1">Recent Urgent Updates:</div>
            <div className="opacity-80">• Emergency protocols updated</div>
            <div className="opacity-80">• New evacuation routes available</div>
          </div>
        </div>
      )}
      
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
          
          {/* Filters Component */}
          <FiltersComponent 
            value={filters} 
            onChange={handleFiltersChange} 
            categories={categories} 
          />
          
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

        {showBuy && (
          <PurchaseModal 
            item={{ id:'kit_first_aid', name:'First Aid Kit', price:29.99 }} 
            onClose={() => setShowBuy(false)} 
          />
        )}
      </div>
    </div>
  )
}
