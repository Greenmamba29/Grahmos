import './globals.css'
import { ServiceWorkerProvider } from '../components/ServiceWorkerProvider'
import { AnalyticsProvider } from '../components/AnalyticsProvider'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'GrahmOS Directory - Emergency Preparedness Platform',
  description: 'Offline-first emergency preparedness platform with AI assistant, interactive mapping, and comprehensive search capabilities',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GrahmOS',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'application-name': 'GrahmOS',
    'msapplication-TileColor': '#3b82f6',
    'msapplication-config': '/browserconfig.xml',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: [
      { url: '/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/app-icon.svg',
        color: '#3b82f6',
      },
    ],
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#3b82f6',
  colorScheme: 'dark'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* PWA Meta Tags */}
        <meta name="theme-color" content="#3b82f6" />
        <meta name="msapplication-navbutton-color" content="#3b82f6" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* Prevent zoom on iOS */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        
        {/* Preconnect for performance */}
        <link rel="preconnect" href="https://tile.openstreetmap.org" />
        
        {/* Service Worker registration is handled by ServiceWorkerProvider */}
      </head>
      <body className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-neutral-100">
        <AnalyticsProvider>
          <ServiceWorkerProvider>
            {/* Clean Header */}
            <header className="w-full bg-neutral-900/50 backdrop-blur-md border-b border-neutral-800/50 sticky top-0 z-40">
              <div className="max-w-6xl mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-bold text-white">G</span>
                    </div>
                    <div>
                      <h1 className="text-lg font-bold text-white">GrahmOS Directory</h1>
                      <p className="text-xs text-neutral-400">Emergency Preparedness Platform</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="px-3 py-1.5 bg-emerald-600/20 text-emerald-400 rounded-full text-xs font-medium border border-emerald-600/30">
                      <div className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full mr-2 animate-pulse"></div>
                      Offline-First
                    </div>
                  </div>
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto p-6">
              <div className="min-h-screen">
                {children}
              </div>
            </main>
          </ServiceWorkerProvider>
        </AnalyticsProvider>
      </body>
    </html>
  )
}
