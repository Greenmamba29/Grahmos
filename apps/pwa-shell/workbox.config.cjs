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
        cacheableResponse: { statuses: [0, 200] }
      }
    },
    // images/css/js also through proxy (after HTML rewrite)
    {
      urlPattern: ({url}) => url.pathname.startsWith('/api/kiwix') && /\.(png|jpe?g|gif|svg|css|js|webp|woff2?)$/i.test(url.search),
      handler: 'CacheFirst',
      options: {
        cacheName: 'kiwix-assets',
        cacheableResponse: { statuses: [0, 200] },
        expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 30 }
      }
    },
    // AI Assistant API
    {
      urlPattern: ({url}) => url.pathname.startsWith('/api/ai'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'ai-assistant',
        cacheableResponse: { statuses: [0, 200] },
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 } // 1 day
      }
    },
    // AI model files and offline packs
    {
      urlPattern: ({url}) => /\.(bin|onnx|safetensors|model)$/i.test(url.pathname) || url.pathname.includes('/models/'),
      handler: 'CacheFirst',
      options: {
        cacheName: 'ai-models',
        cacheableResponse: { statuses: [0, 200] },
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 90 } // 90 days
      }
    }
  ]
}
