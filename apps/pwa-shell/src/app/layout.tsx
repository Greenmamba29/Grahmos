'use client'
import './globals.css'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ServiceWorkerProvider } from '../components/ServiceWorkerProvider'
import { useEffect, useState } from 'react'
import { getAppSettings, setAppSettings } from '../lib/settings'
import Diagnostics from './(components)/Diagnostics'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [redMode, setRedMode] = useState(false)
  const [syncDiagnostics, setSyncDiagnostics] = useState<{ getPeers?: () => number; lastMessageTime?: number }>({})
  const pathname = usePathname()

  useEffect(() => {
    getAppSettings().then(settings => setRedMode(settings.redMode))
    
    if (typeof window !== 'undefined') {
      const checkSync = () => {
        const windowWithSync = window as typeof window & { __sync?: { getPeers: () => number; lastMessageTime: number } }
        if (windowWithSync.__sync) {
          setSyncDiagnostics({
            getPeers: windowWithSync.__sync.getPeers,
            lastMessageTime: windowWithSync.__sync.lastMessageTime
          })
        }
      }
      checkSync()
      const interval = setInterval(checkSync, 2000)
      return () => clearInterval(interval)
    }
  }, [])

  const toggleRedMode = async () => {
    const newMode = !redMode
    setRedMode(newMode)
    await setAppSettings({ redMode: newMode })
    
    // Update peer sync cadence if available
    if (typeof window !== 'undefined') {
      try {
        const { updateCadence } = await import('../../../../packages/p2p-delta/src/peerSync')
        updateCadence(newMode ? 'red' : 'normal')
        console.log(`Red mode ${newMode ? 'enabled' : 'disabled'}, cadence switched to ${newMode ? 'red' : 'normal'}`)
      } catch (e) {
        console.warn('Failed to update cadence:', e)
      }
    }
  }

  return (
    <html lang="en" className={redMode ? 'red-mode' : ''}>
      <body className="min-h-screen bg-neutral-950 text-neutral-100">
        <ServiceWorkerProvider>
          <div className="w-full border-b border-neutral-800 py-3 px-4 text-sm flex justify-between items-center">
            <div>
              <span className="font-semibold">GrahmOS Directory</span>
              <span className="opacity-60 ml-2">offline-first</span>
              {redMode && <span className="ml-2 px-2 py-1 bg-red-700 text-xs rounded">Red Mode</span>}
            </div>
            <div className="flex items-center gap-4">
              <Diagnostics {...syncDiagnostics} />
              <button
                onClick={toggleRedMode}
                className="px-3 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded"
              >
                {redMode ? 'Exit Red Mode' : 'Red Mode'}
              </button>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="w-full border-b border-neutral-800 bg-neutral-900/50">
            <div className="max-w-5xl mx-auto px-4 py-2">
              <div className="flex space-x-6">
                <Link 
                  href="/" 
                  className={`text-sm px-3 py-2 rounded transition-colors ${
                    pathname === '/' 
                      ? 'bg-neutral-800 text-white' 
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                  }`}
                >
                  Search
                </Link>
                <Link 
                  href="/packs" 
                  className={`text-sm px-3 py-2 rounded transition-colors ${
                    pathname === '/packs' 
                      ? 'bg-neutral-800 text-white' 
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                  }`}
                >
                  Packs
                </Link>
                <Link 
                  href="/settings" 
                  className={`text-sm px-3 py-2 rounded transition-colors ${
                    pathname === '/settings' 
                      ? 'bg-neutral-800 text-white' 
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                  }`}
                >
                  Settings
                </Link>
              </div>
            </div>
          </nav>
          
          <main className="max-w-5xl mx-auto p-4">{children}</main>
        </ServiceWorkerProvider>
      </body>
    </html>
  )
}
