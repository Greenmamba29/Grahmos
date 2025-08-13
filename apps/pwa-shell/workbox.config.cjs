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
          maxEntries: 5000,  // Up to 5k HTML entries
          maxAgeSeconds: 60 * 60 * 24 * 7  // 7 days for HTML
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
          maxEntries: 3000,  // Up to 3k asset entries
          maxAgeSeconds: 60 * 60 * 24 * 30  // 30 days for assets
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
          maxEntries: 100,  // PMTiles can be large, limit entries
          maxAgeSeconds: 60 * 60 * 24 * 60  // 60 days for tiles
        }
      }
    }
  ]
}
