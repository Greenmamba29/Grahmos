'use client'
import { useRef, useEffect, useMemo } from 'react'
import { Map, MapRef, Source, Layer } from 'react-map-gl/maplibre'
import { DeckGL } from '@deck.gl/react'
import { LineLayer, ScatterplotLayer, PolygonLayer } from '@deck.gl/layers'
import type { MapOverlay } from './MapView'

interface Map2DProps {
  viewport: {
    latitude: number
    longitude: number
    zoom: number
  }
  overlays: (MapOverlay & { color: string })[]
  onViewportChange: (viewport: any) => void
  onLocationSelect?: (lat: number, lng: number) => void
}

export default function Map2D({ 
  viewport, 
  overlays, 
  onViewportChange, 
  onLocationSelect 
}: Map2DProps) {
  const mapRef = useRef<MapRef>(null)

  // Create Deck.gl layers from overlays
  const deckLayers = useMemo(() => {
    const layers = []

    // Evacuation routes
    const routes = overlays.filter(o => o.type === 'evacuation-route')
    if (routes.length > 0) {
      layers.push(new LineLayer({
        id: 'evacuation-routes',
        data: routes,
        getSourcePosition: (d: any) => d.coordinates[0],
        getTargetPosition: (d: any) => d.coordinates[1],
        getColor: (d: any) => hexToRgb(d.color),
        getWidth: (d: any) => d.properties.priority === 'high' ? 5 : 3,
        pickable: true,
        onHover: ({ object }) => {
          if (object) {
            console.log('Route:', object.properties.name)
          }
        }
      }))
    }

    // Evacuation points
    const points = overlays.filter(o => o.type === 'evacuation-point')
    if (points.length > 0) {
      layers.push(new ScatterplotLayer({
        id: 'evacuation-points',
        data: points,
        getPosition: (d: any) => d.coordinates[0],
        getRadius: (d: any) => d.properties.priority === 'high' ? 50 : 30,
        getFillColor: (d: any) => hexToRgb(d.color),
        pickable: true,
        onHover: ({ object }) => {
          if (object) {
            console.log('Point:', object.properties.name)
          }
        }
      }))
    }

    // Hazard and safe zones
    const zones = overlays.filter(o => o.type === 'hazard-zone' || o.type === 'safe-zone')
    if (zones.length > 0) {
      layers.push(new PolygonLayer({
        id: 'zones',
        data: zones,
        getPolygon: (d: any) => d.coordinates,
        getFillColor: (d: any) => [...hexToRgb(d.color), 80], // Semi-transparent
        getLineColor: (d: any) => hexToRgb(d.color),
        getLineWidth: 2,
        pickable: true,
        onHover: ({ object }) => {
          if (object) {
            console.log('Zone:', object.properties.name)
          }
        }
      }))
    }

    return layers
  }, [overlays])

  // Handle map clicks
  const handleMapClick = (event: any) => {
    const { lngLat } = event
    onLocationSelect?.(lngLat.lat, lngLat.lng)
  }

  return (
    <div className="w-full h-full relative">
      <Map
        ref={mapRef}
        {...viewport}
        onMove={evt => onViewportChange(evt.viewState)}
        onClick={handleMapClick}
        style={{ width: '100%', height: '100%' }}
        mapStyle={{
          version: 8,
          sources: {
            'osm': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors'
            }
          },
          layers: [
            {
              id: 'osm',
              type: 'raster',
              source: 'osm'
            }
          ]
        }}
      >
        {/* PMTiles source for vector data */}
        <Source
          id="pmtiles-source"
          type="vector"
          url="pmtiles://https://example.com/tiles.pmtiles"
        >
          <Layer
            id="countries"
            type="fill"
            source="pmtiles-source"
            source-layer="countries"
            paint={{
              'fill-color': '#627BC1',
              'fill-opacity': 0.1
            }}
          />
        </Source>

        {/* Deck.gl overlay */}
        <DeckGL
          viewState={viewport}
          layers={deckLayers}
          controller={false} // Let MapLibre handle interactions
        />
      </Map>

      {/* Map attribution */}
      <div className="absolute bottom-2 right-2 text-xs text-neutral-400 bg-neutral-900/80 px-2 py-1 rounded">
        2D Mode • MapLibre + Deck.gl
      </div>
    </div>
  )
}

// Helper function to convert hex color to RGB array
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ]
    : [128, 128, 128] // Default gray
}
