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
    // PMTiles offline maps
    {
      urlPattern: /\.pmtiles(\?.*)?$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'pmtiles',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 30 * 24 * 60 * 60
        }
      }
    }
  ]
}
