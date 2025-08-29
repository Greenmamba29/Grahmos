'use client'

export default function Map3D() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-neutral-400">
      <div className="text-6xl mb-4">🌍</div>
      <div className="text-xl mb-2 font-medium">3D Globe</div>
      <div className="text-sm mb-1 text-center">Coming Soon</div>
      <div className="text-xs text-neutral-500 text-center max-w-sm">
        The 3D mapping feature will provide interactive globe visualization with emergency overlays, 
        evacuation routes, and real-time hazard zones.
      </div>
      <div className="mt-6 text-xs text-neutral-600">
        Please use 2D mode for full functionality
      </div>
    </div>
  )
}
