module.exports = {
  globDirectory: ".next",
  globPatterns: ["**/*.{js,css,woff2,html}", "../public/**/*"],
  swDest: "public/sw.js",
  navigateFallback: "/",
  runtimeCaching: [
    // HTML via proxy
    {
      urlPattern: ({url}) => url.pathname.startsWith('/api/kiwix'),
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'kiwix-html',
        cacheableResponse: { statuses: [0, 200] },
        expiration: { 
          maxEntries: 2000,  // Reduced to 2k HTML entries for better performance
          maxAgeSeconds: 60 * 60 * 24 * 7,  // 7 days for HTML
          purgeOnQuotaError: true  // Auto-purge on quota issues
        }
      }
    },
    // images/css/js also through proxy (after HTML rewrite)
    {
      urlPattern: ({url}) => url.pathname.startsWith('/api/kiwix') && /\.(png|jpe?g|gif|svg|css|js|webp|woff2?)$/i.test(url.search),
      handler: 'CacheFirst',
      options: {
        cacheName: 'kiwix-assets',
        cacheableResponse: { statuses: [0, 200] },
        expiration: { 
          maxEntries: 2000,  // Reduced to 2k asset entries for better performance
          maxAgeSeconds: 60 * 60 * 24 * 30,  // 30 days for assets
          purgeOnQuotaError: true  // Auto-purge on quota issues
        }
      }
    },
    // PMTiles for map data
    {
      urlPattern: ({url}) => url.pathname.includes('.pmtiles') || url.search.includes('pmtiles'),
      handler: 'CacheFirst',
      options: {
        cacheName: 'pmtiles',
        cacheableResponse: { statuses: [0, 200] },
        expiration: { 
          maxEntries: 100,  // PMTiles can be large, keep tight limit
          maxAgeSeconds: 60 * 60 * 24 * 60,  // 60 days for tiles
          purgeOnQuotaError: true  // Auto-purge on quota issues
        }
      }
    }
  ]
}
