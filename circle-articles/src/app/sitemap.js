// src/app/sitemap.js
import { apiClient } from '@/lib/api';

const BASE_URL = 'https://blog.circlenet.social'; 

export default async function sitemap() {
  // Fetch all articles (you may need to paginate if many)
  let allArticles = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const res = await apiClient(`/api/articles?page=${page}&limit=50`);
      const articles = res.data?.articles || [];
      allArticles.push(...articles);
      hasMore = articles.length === 50; // if limit reached, assume more
      page++;
    } catch (err) {
      console.error('Failed to fetch articles for sitemap:', err);
      break;
    }
  }

  // Static routes
  const staticRoutes = [
    {
      url: `${BASE_URL}/articles`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  // Dynamic article routes
  const articleRoutes = allArticles.map((article) => ({
    url: `${BASE_URL}/articles/${article.slug}`,
    lastModified: new Date(article.updatedAt || article.createdAt),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...articleRoutes];
}