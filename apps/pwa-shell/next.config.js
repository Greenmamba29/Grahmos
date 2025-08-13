/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['p2p-delta', 'crypto-verify', 'local-db', 'search-core'],
  experimental: {
    esmExternals: 'loose'
  },
  async rewrites(){
    return [
      { source: '/purchase', destination: 'http://localhost:8787/purchase' },
      { source: '/pubkey', destination: 'http://localhost:8787/pubkey' }
    ]
  }
}

module.exports = nextConfig
