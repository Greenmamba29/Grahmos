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
      <body className="min-h-screen bg-neutral-950 text-neutral-100">
        <AnalyticsProvider>
          <ServiceWorkerProvider>
            <div className="w-full border-b border-neutral-800 py-3 px-4 text-sm">
              <span className="font-semibold">GrahmOS Directory</span>
              <span className="opacity-60 ml-2">offline-first</span>
            </div>
            <main className="max-w-5xl mx-auto p-4">{children}</main>
          </ServiceWorkerProvider>
        </AnalyticsProvider>
      </body>
    </html>
  )
}
