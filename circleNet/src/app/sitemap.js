// src/app/sitemap.js
import { apiClient } from '@/lib/api';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.circlenet.social';

export default async function sitemap() {
  const allArticles = [];
  const allUsers = [];
  let page = 1;

  // ── Fetch all articles ──
  while (true) {
    try {
      const res = await apiClient(`/api/articles?page=${page}&limit=50`);
      const articles = res?.data?.articles ?? [];

      if (!articles.length) break;

      allArticles.push(...articles);

      if (articles.length < 50) break; // last page
      page++;
    } catch (err) {
      console.error(`Sitemap: failed fetching articles page ${page}:`, err);
      break;
    }
  }

  // ── Fetch all public users (for profile pages) ──
  page = 1;
  while (true) {
    try {
      const res = await apiClient(`/api/users?limit=100&page=${page}`);
      const users = res?.data ?? [];

      if (!users.length) break;

      // Only include users with a username (public profiles)
      const publicUsers = users.filter((u) => u.username);
      allUsers.push(...publicUsers);

      if (users.length < 100) break; // last page
      page++;
    } catch (err) {
      console.error(`Sitemap: failed fetching users page ${page}:`, err);
      break;
    }
  }

  // ── Static routes ──
  const staticRoutes = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/feed`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/explore`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/groups`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/articles`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];

  // ── Article routes ──
  const articleRoutes = allArticles
    .filter((a) => a.slug)
    .map((article) => ({
      url: `${BASE_URL}/articles/${article.slug}`,
      lastModified: new Date(article.updatedAt ?? article.createdAt),
      changeFrequency: 'weekly',
      priority: 0.7,
    }));

  // ── User profile routes ──
  const userRoutes = allUsers.map((user) => ({
    url: `${BASE_URL}/profile/${user.username}`,
    lastModified: new Date(user.updatedAt ?? user.createdAt ?? Date.now()),
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  // ── Combine all routes ──
  return [...staticRoutes, ...articleRoutes, ...userRoutes];
}