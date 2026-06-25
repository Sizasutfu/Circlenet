import { apiClient } from '@/lib/api';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.circlenet.social';

export default async function sitemap() {
  const allArticles = [];
  let page = 1;

  while (true) {
    try {
      const res = await apiClient(`/api/articles?page=${page}&limit=50`);
      const articles = res?.data?.articles ?? [];

      if (!articles.length) break;

      allArticles.push(...articles);

      if (articles.length < 50) break; // last page
      page++;
    } catch (err) {
      // Log and stop — partial sitemap is better than a build failure
      console.error(`Sitemap: failed fetching page ${page}:`, err);
      break;
    }
  }

  const staticRoutes = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/articles`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  const articleRoutes = allArticles
    .filter((a) => a.slug) // skip any malformed entries
    .map((article) => ({
      url: `${BASE_URL}/articles/${article.slug}`,
      lastModified: new Date(article.updatedAt ?? article.createdAt),
      changeFrequency: 'weekly',
      priority: 0.7,
    }));

  return [...staticRoutes, ...articleRoutes];
}