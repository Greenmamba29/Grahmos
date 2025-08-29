'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'

// Dynamic imports to handle client-side only libraries
const DynamicMap = dynamic(() => import('./Map2D'), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full">Loading 2D Map...</div>
})

// Temporarily disable 3D globe due to build issues
const DynamicGlobe = () => (
  <div className="flex flex-col items-center justify-center h-full bg-neutral-900 text-neutral-400">
    <div className="text-lg mb-2">🌍</div>
    <div className="text-sm mb-1">3D Globe temporarily disabled</div>
    <div className="text-xs text-neutral-500">Use 2D mode for full functionality</div>
  </div>
)

export interface MapOverlay {
  id: string
  type: 'evacuation-route' | 'evacuation-point' | 'hazard-zone' | 'safe-zone'
  coordinates: number[][]
  properties: {
    name: string
    description?: string
    priority?: 'low' | 'medium' | 'high'
    status?: 'active' | 'inactive'
  }
}

interface MapViewProps {
  overlays?: MapOverlay[]
  onLocationSelect?: (lat: number, lng: number) => void
  initialViewport?: {
    latitude: number
    longitude: number
    zoom: number
  }
}

export default function MapView({ 
  overlays = [], 
  onLocationSelect,
  initialViewport = { latitude: 37.7749, longitude: -122.4194, zoom: 10 }
}: MapViewProps) {
  const [is3D, setIs3D] = useState(false)
  const [viewport, setViewport] = useState(initialViewport)
  const [performanceState, setPerformanceState] = useState({ fps: 0, renderTime: 0 })
  const performanceRef = useRef<{ frameCount: number; lastTime: number }>({ 
    frameCount: 0, 
    lastTime: performance.now() 
  })

  // Performance monitoring
  const updatePerformance = useCallback(() => {
    const now = performance.now()
    const { frameCount, lastTime } = performanceRef.current
    
    if (now - lastTime >= 1000) {
      const fps = Math.round((frameCount * 1000) / (now - lastTime))
      setPerformanceState(prev => ({ ...prev, fps }))
      performanceRef.current = { frameCount: 0, lastTime: now }
    } else {
      performanceRef.current.frameCount++
    }
  }, [])

  // Handle viewport changes between 2D/3D modes
  const handleViewportChange = useCallback((newViewport: typeof viewport) => {
    setViewport(newViewport)
  }, [])

  // Handle mode toggle
  const toggleMapMode = useCallback(() => {
    setIs3D(!is3D)
  }, [is3D])

  // Emergency overlays processing
  const processedOverlays = overlays.map(overlay => ({
    ...overlay,
    color: getOverlayColor(overlay.type, overlay.properties.priority)
  }))

  return (
    <div className="relative w-full h-full">
      {/* Map Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <button
          onClick={toggleMapMode}
          className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-lg text-sm font-medium transition-colors"
        >
          {is3D ? '2D Map' : '3D Globe'}
        </button>
        
        {/* Performance Monitor */}
        <div className="px-3 py-2 bg-neutral-900/90 border border-neutral-700 rounded-lg text-xs">
          <div>FPS: {performanceState.fps}</div>
          <div>Mode: {is3D ? '3D' : '2D'}</div>
        </div>
      </div>

      {/* Layer Controls */}
      <div className="absolute top-4 right-4 z-10">
        <div className="bg-neutral-900/90 border border-neutral-700 rounded-lg p-3">
          <h3 className="text-sm font-medium mb-2">Emergency Layers</h3>
          <div className="space-y-1 text-xs">
            {['evacuation-route', 'evacuation-point', 'hazard-zone', 'safe-zone'].map(type => {
              const count = overlays.filter(o => o.type === type).length
              return (
                <div key={type} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: getOverlayColor(type as MapOverlay['type']) }}
                  />
                  <span className="capitalize">{type.replace('-', ' ')}</span>
                  <span className="text-neutral-400">({count})</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Map Content */}
      <div className="w-full h-full">
        {is3D ? (
          <DynamicGlobe />
        ) : (
          <DynamicMap 
            viewport={viewport}
            overlays={processedOverlays}
            onViewportChange={handleViewportChange}
            onLocationSelect={onLocationSelect}
          />
        )}
      </div>
    </div>
  )
}

function getOverlayColor(type: MapOverlay['type'], priority?: 'low' | 'medium' | 'high'): string {
  const colors = {
    'evacuation-route': '#22c55e', // Green
    'evacuation-point': '#3b82f6', // Blue
    'hazard-zone': '#ef4444',      // Red
    'safe-zone': '#10b981'         // Emerald
  }
  
  let baseColor = colors[type] || '#6b7280'
  
  // Adjust opacity based on priority
  if (priority === 'high') return baseColor + 'ff'
  if (priority === 'medium') return baseColor + 'cc'
  if (priority === 'low') return baseColor + '80'
  
  return baseColor + 'cc'
}
