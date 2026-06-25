// src/app/robots.txt
export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/', // block internal API routes
    },
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.circlenet.social'}/sitemap.xml`,
  };
}