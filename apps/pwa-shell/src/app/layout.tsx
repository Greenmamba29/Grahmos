'use client'
import './globals.css'
import { ServiceWorkerProvider } from '../components/ServiceWorkerProvider'
import { useEffect, useState } from 'react'
import { getAppSettings, setAppSettings } from '../lib/settings'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [redMode, setRedMode] = useState(false)

  useEffect(() => {
    getAppSettings().then(settings => setRedMode(settings.redMode))
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
            <button
              onClick={toggleRedMode}
              className="px-3 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 rounded"
            >
              {redMode ? 'Exit Red Mode' : 'Red Mode'}
            </button>
          </div>
          <main className="max-w-5xl mx-auto p-4">{children}</main>
        </ServiceWorkerProvider>
      </body>
    </html>
  )
}
