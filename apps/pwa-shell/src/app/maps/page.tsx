'use client'
import { useEffect, useRef } from 'react'

export default function MapsPage() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    const initMap = async () => {
      const maplibregl = await import('maplibre-gl')
      const { Protocol } = await import('pmtiles')

      const protocol = new Protocol()
      maplibregl.addProtocol('pmtiles', protocol.tile)

      map.current = new maplibregl.Map({
        container: mapContainer.current!,
        style: {
          version: 8,
          sources: {
            'pmtiles-source': {
              type: 'vector',
              url: 'pmtiles:///tiles/world.pmtiles'
            },
            'emergency-data': {
              type: 'geojson',
              data: '/data/emergency.json'
            }
          },
          layers: [
            {
              id: 'background',
              type: 'background',
              paint: { 'background-color': '#1a1a1a' }
            },
            {
              id: 'emergency-points',
              source: 'emergency-data',
              type: 'circle',
              paint: {
                'circle-radius': 8,
                'circle-color': '#ef4444'
              }
            }
          ]
        },
        center: [0, 0],
        zoom: 2
      })
    }

    initMap().catch(console.error)

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Offline Maps</h1>
      <div 
        ref={mapContainer}
        className="w-full h-[70vh] border border-neutral-800 rounded-lg"
      />
    </div>
  )
}
