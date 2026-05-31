// src/app/robots.txt
export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/', // block internal API routes
    },
    sitemap: 'https://blog.circlenet.social/sitemap.xml',
  };
}