import './globals.css'
import { ServiceWorkerProvider } from '../components/ServiceWorkerProvider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100">
        <ServiceWorkerProvider>
          <div className="w-full border-b border-neutral-800 py-3 px-4 text-sm">
            <span className="font-semibold">GrahmOS Directory</span>
            <span className="opacity-60 ml-2">offline-first</span>
          </div>
          <main className="max-w-5xl mx-auto p-4">{children}</main>
        </ServiceWorkerProvider>
      </body>
    </html>
  )
}
