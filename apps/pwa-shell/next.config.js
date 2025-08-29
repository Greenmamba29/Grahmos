/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['p2p-delta', 'crypto-verify', 'local-db', 'search-core'],
  experimental: {
    esmExternals: 'loose'
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // Handle Cesium and other mapping libraries
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      }
      
      // Handle Cesium's use of require in browser
      config.module.rules.push({
        test: /cesium.*\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ['@babel/plugin-transform-modules-commonjs']
          }
        }
      })
    }
    
    return config
  },
  async rewrites(){
    return [
      { source: '/purchase', destination: 'http://localhost:8787/purchase' },
      { source: '/pubkey', destination: 'http://localhost:8787/pubkey' }
    ]
  }
}

module.exports = nextConfig
