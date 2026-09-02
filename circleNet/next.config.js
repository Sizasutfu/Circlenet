/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Allow connections from this IP (for network testing) ──
  allowedDevOrigins: ['10.110.51.203'],

  // ── Development server HTTPS (using mkcert certificates) ──
  // Only applies to `next dev` – ignored in production (`next start`)
  server: {
    https: true,
    key: './localhost+2-key.pem',    // Adjust path if certs are elsewhere
    cert: './localhost+2.pem',
  },

  // ── Rewrites – proxy API and uploads to your Circle backend ──
  rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'}/uploads/:path*`,
      },
    ];
  },

  // ── Security headers ──
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
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
        ],
      },
      {
        source: '/:slug/opengraph-image.png',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=86400' },
        ],
      },
    ];
  },

  // ── Redirect root to feed ──
  async redirects() {
    return [
      {
        source: '/',
        destination: '/feed',
        permanent: true,
      },
    ];
  },

  // ── Image domains ──
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