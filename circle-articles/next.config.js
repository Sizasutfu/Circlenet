/** @type {import('next').NextConfig} */
const nextConfig = {
  // ──────────────────────────────────────────────────────────
  //  Serve the entire blog under the /articles path prefix
  // ──────────────────────────────────────────────────────────
  //basePath: '/articles',
  //assetPrefix: '/articles',


  // assetPrefix is usually not needed unless static assets are on a CDN.
  // Keep it commented unless you have a specific reason.
  // assetPrefix: '/articles',

  // ──────────────────────────────────────────────────────────
  //  Development only – allow LAN access (optional)
  // ──────────────────────────────────────────────────────────
  allowedDevOrigins: ['10.99.112.203'],

  // ──────────────────────────────────────────────────────────
  //  Rewrites – proxy API uploads to your Circle backend
  // ──────────────────────────────────────────────────────────
  rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'}/uploads/:path*`,
      },
    ];
  },

  // ──────────────────────────────────────────────────────────
  //  Security headers
  // ──────────────────────────────────────────────────────────
  headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security',  value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      // ──────────────────────────────────────────────────────
      //  OG image caching – path corrected for basePath
      //  (source is matched after basePath is stripped)
      // ──────────────────────────────────────────────────────
      {
        source: '/:slug/opengraph-image.png',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=86400' },
        ],
      },
    ];
  },

  // ──────────────────────────────────────────────────────────
  //  Image domains – allow external images
  // ──────────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.circlenet.social',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5000',
      },
    ],
  },
};

module.exports = nextConfig;