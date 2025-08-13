'use client'
import './globals.css'
import { ServiceWorkerProvider } from '../components/ServiceWorkerProvider'
import { useEffect, useState } from 'react'
import { getAppSettings, setAppSettings } from '../lib/settings'
import Diagnostics from './(components)/Diagnostics'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [redMode, setRedMode] = useState(false)
  const [syncDiagnostics, setSyncDiagnostics] = useState<{ getPeers?: () => number; lastMessageTime?: number }>({})

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
          <main className="max-w-5xl mx-auto p-4">{children}</main>
        </ServiceWorkerProvider>
      </body>
    </html>
  )
}
