/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features for multi-domain support
  experimental: {
    // This will be useful when adding 15 domains
  },
  
  // Configure headers for geo data passthrough
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'x-geo-enabled',
            value: 'true',
          },
        ],
      },
    ]
  },

  // Placeholder for future multi-domain configuration
  // When adding 15 domains, configure them here:
  // async rewrites() {
  //   return {
  //     beforeFiles: [
  //       // Domain-specific rewrites will go here
  //     ],
  //   }
  // },
}

export default nextConfig
