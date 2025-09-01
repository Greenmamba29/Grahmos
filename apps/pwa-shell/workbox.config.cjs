module.exports = {
  globDirectory: "out",
  globPatterns: [
    "**/*.{js,css,woff2,html,json,png,jpg,jpeg,gif,svg,webp,ico}",
    "catalog.seed.json",
    "manifest.json"
  ],
  swDest: "public/sw.js",
  navigateFallback: "/",
  navigateFallbackAllowlist: [/^(?!.*\.[^/]*$)/], // Only for routes, not files
  skipWaiting: true,
  clientsClaim: true,
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
  
  runtimeCaching: [
    // App shell and pages - offline first
    {
      urlPattern: ({request}) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages-cache',
        networkTimeoutSeconds: 3,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 // 24 hours
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    },
    
    // Static assets - cache first
    {
      urlPattern: ({request}) => request.destination === 'script' ||
                                 request.destination === 'style' ||
                                 request.destination === 'worker',
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    },
    
    // Images and media - cache first with longer expiration
    {
      urlPattern: ({request}) => request.destination === 'image',
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 90 // 90 days
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    },
    
    // Map tiles - critical for offline mapping
    {
      urlPattern: ({url}) => url.hostname === 'tile.openstreetmap.org',
      handler: 'CacheFirst',
      options: {
        cacheName: 'map-tiles',
        expiration: {
          maxEntries: 1000,
          maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    },
    
    // Emergency data - critical offline content
    {
      urlPattern: ({url}) => url.pathname.includes('catalog.seed.json') ||
                             url.pathname.includes('emergency') ||
                             url.pathname.includes('manifest.json'),
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'emergency-data',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    },
    
    // API fallback for when offline
    {
      urlPattern: ({url}) => url.pathname.startsWith('/api/'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-fallback',
        networkTimeoutSeconds: 3,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 5 // 5 minutes
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    },
    
    // Fonts - cache first
    {
      urlPattern: ({request}) => request.destination === 'font',
      handler: 'CacheFirst',
      options: {
        cacheName: 'font-cache',
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    }
  ]
}
